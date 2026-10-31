"""Smoke test and benchmark the packaged worker using public synthetic fixtures."""
import base64
import json
import os
from pathlib import Path
import queue
import statistics
import subprocess
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "src-tauri" / "resources" / "ocr"
EXPECTED = {"en": "HelloadventurerQuestcomplete", "zh": "冒险者你好请接受新的任务", "ja": "冒険者よ新しい世界へ"}


def main():
    started = time.perf_counter()
    child = subprocess.Popen([str(RUNTIME / "stor-ocr.exe"), "--models", str(RUNTIME / "models")],
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                             creationflags=subprocess.CREATE_NO_WINDOW,
                             env={**os.environ, "HTTP_PROXY": "http://127.0.0.1:9", "HTTPS_PROXY": "http://127.0.0.1:9"})
    packets = queue.Queue()

    def read():
        for line in child.stdout:
            packets.put(json.loads(line))
        packets.put({"error": "worker exited"})

    threading.Thread(target=read, daemon=True).start()
    try:
        ready = packets.get(timeout=60)
        assert ready.get("ready") and ready.get("model") == "PP-OCRv6 small", ready
        report = {"model": ready["model"], "startupMs": round((time.perf_counter() - started) * 1000),
                  "modelLoadMs": ready["loadMs"], "fixtures": [], "httpProxyUnreachable": True}
        request_id = 0
        for language, expected in EXPECTED.items():
            image = (ROOT / "audit" / "evidence" / f"ocr-{language}.png").read_bytes()
            times = []
            for _ in range(5):
                request_id += 1
                payload = {"id": request_id, "png": base64.b64encode(image).decode("ascii")}
                child.stdin.write((json.dumps(payload) + "\n").encode("utf-8"))
                child.stdin.flush()
                response = packets.get(timeout=30)
                assert response.get("id") == request_id and response.get("ok"), response
                assert "".join(response["text"].split()) == expected, response
                times.append(response["elapsedMs"])
            report["fixtures"].append({"language": language, "exactMatch": True,
                                       "runs": len(times), "medianMs": statistics.median(times), "maxMs": max(times)})
        report["runtimeBytes"] = sum(path.stat().st_size for path in RUNTIME.rglob("*") if path.is_file())
        output = ROOT / "audit" / "evidence" / "ocr-v6-benchmark.json"
        output.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))
    finally:
        child.stdin.close()
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait(timeout=5)


if __name__ == "__main__":
    main()
