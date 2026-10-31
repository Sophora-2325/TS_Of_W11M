from PIL import Image
from pathlib import Path

base = Path(r"D:\STOR\.cache\guides")
out = base / "crops"
out.mkdir(exist_ok=True)

jobs = {
    "tech-tall-1440.png": [(0, 1000), (1000, 2200), (2200, 3400), (3400, 4600), (4600, 5800)],
    "plan-tall-1440.png": [(0, 1000), (1000, 2200), (2200, 3400), (3400, 4600), (4600, 5800)],
    "tech-tall-390.png": [(0, 1200), (1200, 2400), (2400, 3600), (3600, 4800), (4800, 6000), (6000, 7200)],
    "plan-tall-390.png": [(0, 1200), (1200, 2400), (2400, 3600), (3600, 4800), (4800, 6000), (6000, 7200)],
}
for name, ranges in jobs.items():
    image = Image.open(base / name)
    print(name, image.size)
    stem = name.replace(".png", "")
    for i, (top, bottom) in enumerate(ranges, 1):
        bottom = min(bottom, image.height)
        crop = image.crop((0, top, image.width, bottom))
        crop.save(out / f"{stem}-{i:02d}.png")
print("saved crops")
