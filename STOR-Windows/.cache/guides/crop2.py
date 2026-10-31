from PIL import Image
from pathlib import Path

base = Path(r"D:\STOR\.cache\guides")
out = base / "crops2"
out.mkdir(exist_ok=True)

jobs = {
    "tech-full-1440.png": [(5500, 6800), (6800, 8100), (8100, 9400), (9400, 10700), (10700, 12000)],
    "plan-full-1440.png": [(5500, 6800), (6800, 8100), (8100, 9400), (9400, 10700), (10700, 12000)],
    "tech-full-390.png": [(6000, 7400), (7400, 8800), (8800, 10200), (10200, 11600), (11600, 13000), (13000, 14400)],
    "plan-full-390.png": [(6000, 7400), (7400, 8800), (8800, 10200), (10200, 11600), (11600, 13000), (13000, 14400)],
}
for name, ranges in jobs.items():
    image = Image.open(base / name)
    print(name, image.size)
    stem = name.replace(".png", "")
    for i, (top, bottom) in enumerate(ranges, 1):
        bottom = min(bottom, image.height)
        if top >= image.height:
            continue
        image.crop((0, top, image.width, bottom)).save(out / f"{stem}-{i:02d}.png")
print("saved")
