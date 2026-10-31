"""Generate public synthetic samples and desktop ground truth; never reads user screenshots."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument("--desktop", type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
target = root / "app/src/androidTest/assets/fixtures"
target.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location("stor_worker", args.desktop / "ocr-service/worker.py")
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
engine = worker.create_engine(args.desktop / "src-tauri/resources/ocr/models")
font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 42)
samples = {
    "en": "Read the words on your screen.",
    "zh": "框选屏幕上的文字，识别后可以修改。",
    "ja": "画面の文字を選択してください。",
}
results = []
for language, expected in samples.items():
    image = Image.new("RGB", (1000, 180), "white")
    ImageDraw.Draw(image).text((36, 54), expected, font=font, fill="black")
    path = target / f"{language}.png"
    image.save(path)
    result = engine(image, use_det=True, use_cls=False, use_rec=True)
    text = "\n".join(result.txts or ())
    results.append({"file": path.name, "language": language, "expected": expected,
                    "desktop": text, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
(target / "reference.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(results, ensure_ascii=False, indent=2))
