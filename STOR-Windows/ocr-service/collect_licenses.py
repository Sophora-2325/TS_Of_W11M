"""Retain installed dependency licensing information in the packaged OCR runtime."""
from importlib.metadata import distributions
from pathlib import Path
import shutil
import sys

output = Path(sys.argv[1])
output.mkdir(parents=True, exist_ok=True)
for distribution in distributions():
    name = distribution.metadata["Name"]
    for file in distribution.files or ():
        if any(part.lower().startswith(("license", "licence", "copying", "notice")) for part in file.parts):
            source = Path(distribution.locate_file(file))
            if source.is_file():
                destination = output / name / str(file).replace("..", "_")
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, destination)
python_license = Path(sys.base_prefix) / "LICENSE.txt"
if python_license.exists():
    shutil.copyfile(python_license, output / "Python-LICENSE.txt")
