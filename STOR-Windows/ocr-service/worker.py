"""STOR's offline, CPU-only PP-OCRv6 small worker. JSON Lines over stdio."""
import argparse
import base64
import binascii
from contextlib import redirect_stdout
import hashlib
import json
import os
from pathlib import Path
import sys
import time

PROTOCOL = 1
MODEL = "PP-OCRv6 small"
MAX_PNG_BYTES = 32 * 1024 * 1024
MAX_REQUEST_BYTES = MAX_PNG_BYTES * 4 // 3 + 1024
MAX_PIXELS = 16_777_216


class RequestError(Exception):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


def verify_models(directory):
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    if manifest["name"] != MODEL or {m["role"] for m in manifest["models"]} != {"det", "rec"}:
        raise RuntimeError("Expected PP-OCRv6 small detection and recognition models")
    for model in manifest["models"]:
        path = directory / f"{model['role']}.onnx"
        if hashlib.sha256(path.read_bytes()).hexdigest() != model["sha256"]:
            raise RuntimeError(f"Model checksum mismatch: {path.name}")
        config = (directory / f"{model['role']}.yml").read_bytes()
        blob = f"blob {len(config)}\0".encode() + config
        if hashlib.sha1(blob).hexdigest() != model["configGitBlob"]:
            raise RuntimeError("Model preprocessing configuration checksum mismatch")
    dictionary = directory / "ppocrv6_dict.txt"
    if hashlib.sha256(dictionary.read_bytes()).hexdigest() != manifest["dictionarySha256"]:
        raise RuntimeError("Recognition dictionary checksum mismatch")


def create_engine(directory):
    verify_models(directory)
    import cv2
    import numpy as np
    import yaml
    from rapidocr import RapidOCR
    from rapidocr.utils.download_file import DownloadFile

    # A missing explicit asset must be an error, never a hidden default-model download.
    def reject_download(*_args, **_kwargs):
        raise RuntimeError("STOR OCR is offline; an OCR asset is missing")

    DownloadFile.run = reject_download
    cv2.setNumThreads(1)
    detection = yaml.safe_load((directory / "det.yml").read_text(encoding="utf-8"))
    normalization = next(op["NormalizeImage"] for op in detection["PreProcess"]["transform_ops"] if "NormalizeImage" in op)
    postprocess = detection["PostProcess"]
    engine = RapidOCR(params={
        "Global.use_cls": False,
        "Global.log_level": "error",
        "Global.text_score": 0.5,
        "Global.max_side_len": 4096,
        "Det.model_path": str(directory / "det.onnx"),
        "Det.limit_type": "max",
        "Det.limit_side_len": 1280,
        # Official ONNX uses ImageNet normalization, unlike RapidOCR's defaults.
        "Det.mean": normalization["mean"],
        "Det.std": normalization["std"],
        "Det.thresh": postprocess["thresh"],
        "Det.box_thresh": postprocess["box_thresh"],
        "Det.unclip_ratio": postprocess["unclip_ratio"],
        "Det.max_candidates": postprocess["max_candidates"],
        "Det.use_dilation": False,
        "Rec.model_path": str(directory / "rec.onnx"),
        "Rec.rec_keys_path": str(directory / "ppocrv6_dict.txt"),
        "Rec.rec_img_shape": [3, 48, 320],
        "Rec.rec_batch_num": 4,
        "EngineConfig.onnxruntime.intra_op_num_threads": min(4, os.cpu_count() or 1),
        "EngineConfig.onnxruntime.inter_op_num_threads": 1,
        "EngineConfig.onnxruntime.use_cuda": False,
        "EngineConfig.onnxruntime.use_dml": False,
    })
    warm = np.full((64, 320, 3), 255, dtype=np.uint8)
    cv2.putText(warm, "STOR", (10, 45), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    # RapidOCR loads sessions lazily: run both stages before publishing readiness.
    engine(warm, use_det=True, use_cls=False, use_rec=True)
    engine(warm, use_det=False, use_cls=False, use_rec=True)
    return engine


def decode_image(encoded):
    import cv2
    import numpy as np

    if not isinstance(encoded, str):
        raise RequestError("invalid_image", "截图数据格式错误")
    if len(encoded) > MAX_PNG_BYTES * 4 // 3 + 4:
        raise RequestError("image_too_large", "截图过大，请缩小选区")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise RequestError("invalid_image", "截图数据格式错误") from None
    # Check PNG dimensions before allocating the decoded bitmap.
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise RequestError("invalid_image", "截图不是有效的 PNG 图片")
    width = int.from_bytes(data[16:20], "big")
    height = int.from_bytes(data[20:24], "big")
    if not width or not height or width > 8192 or height > 8192 or width * height > MAX_PIXELS:
        raise RequestError("image_too_large", "截图过大或尺寸无效，请重新框选")
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise RequestError("invalid_image", "截图解码失败，请重新框选")
    return image


def recognize(engine, request):
    image = decode_image(request.get("png"))
    result = engine(image, use_det=True, use_cls=False, use_rec=True)
    texts = result.txts
    text = "\n".join(str(line).strip() for line in (() if texts is None else texts) if str(line).strip())
    if not text:
        raise RequestError("no_text", "未能识别出文字，请尝试扩大选区或手动输入")
    if len(text) > 60_000:
        raise RequestError("too_much_text", "选区文字过多，请缩小选区")
    return text


def emit(output, payload):
    output.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    output.flush()


def serve(engine, source, output):
    for raw in iter(lambda: source.readline(MAX_REQUEST_BYTES + 1), b""):
        if len(raw) > MAX_REQUEST_BYTES:
            emit(output, {"id": None, "ok": False, "code": "request_too_large", "error": "截图过大，请缩小选区"})
            return
        request_id = None
        started = time.perf_counter()
        try:
            request = json.loads(raw)
            if not isinstance(request, dict) or type(request.get("id")) is not int:
                raise RequestError("invalid_request", "OCR 请求格式错误")
            request_id = request["id"]
            # Third-party diagnostics must never contaminate the protocol stream.
            with redirect_stdout(sys.stderr):
                text = recognize(engine, request)
            emit(output, {"id": request_id, "ok": True, "text": text,
                          "elapsedMs": round((time.perf_counter() - started) * 1000)})
        except RequestError as error:
            emit(output, {"id": request_id, "ok": False, "code": error.code, "error": str(error)})
        except (json.JSONDecodeError, UnicodeDecodeError):
            emit(output, {"id": request_id, "ok": False, "code": "invalid_request", "error": "OCR 请求格式错误"})
        except Exception:
            # Do not log screenshots, recognized content, or library tracebacks.
            emit(output, {"id": request_id, "ok": False, "code": "inference_failed",
                          "error": "PP-OCRv6 small 识别失败，请重新框选"})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", type=Path, required=True)
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    sys.stderr.reconfigure(encoding="utf-8", newline="\n")
    output = sys.stdout
    started = time.perf_counter()
    try:
        with redirect_stdout(sys.stderr):
            engine = create_engine(args.models)
        emit(output, {"protocol": PROTOCOL, "ready": True, "model": MODEL,
                      "loadMs": round((time.perf_counter() - started) * 1000)})
    except Exception:
        emit(output, {"protocol": PROTOCOL, "ready": False,
                      "error": "OCR 模型或运行环境加载失败，请重新安装 STOR OCR 组件"})
        return 1
    serve(engine, sys.stdin.buffer, output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
