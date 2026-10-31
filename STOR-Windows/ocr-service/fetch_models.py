"""Build-time download only; inference never downloads models."""
import hashlib
import json
import os
from pathlib import Path
import urllib.request


ROOT = Path(__file__).resolve().parent


def digest(data, git_blob=False):
    if git_blob:
        return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
    return hashlib.sha256(data).hexdigest()


def fetch(url, target, expected, git_blob=False):
    if target.exists() and digest(target.read_bytes(), git_blob) == expected:
        print(f"Verified {target.name}")
        return
    request = urllib.request.Request(url, headers={"User-Agent": "STOR-OCR-Build/1"})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read()
    if digest(data, git_blob) != expected:
        raise RuntimeError(f"Checksum mismatch: {target.name}")
    temporary = target.with_suffix(target.suffix + ".part")
    temporary.write_bytes(data)
    os.replace(temporary, target)
    print(f"Downloaded and verified {target.name}: {len(data)} bytes")


def main():
    import yaml

    directory = ROOT / "models"
    directory.mkdir(exist_ok=True)
    manifest = json.loads((ROOT / "model-sources.json").read_text(encoding="utf-8"))
    for model in manifest["models"]:
        base = f"https://huggingface.co/{model['repository']}/resolve/{model['revision']}"
        role = model["role"]
        fetch(f"{base}/inference.onnx", directory / f"{role}.onnx", model["sha256"])
        fetch(f"{base}/inference.yml", directory / f"{role}.yml", model["configGitBlob"], True)
        fetch(f"{base}/README.md", directory / f"{role}-README.md", model["readmeGitBlob"], True)
    config = yaml.safe_load((directory / "rec.yml").read_text(encoding="utf-8"))
    characters = config["PostProcess"]["character_dict"]
    if not characters or any("\n" in char for char in characters):
        raise RuntimeError("Invalid recognition dictionary")
    dictionary = "\n".join(characters) + "\n"
    (directory / "ppocrv6_dict.txt").write_text(dictionary, encoding="utf-8", newline="\n")
    # Include the generated dictionary in the runtime integrity check.
    manifest["dictionarySha256"] = hashlib.sha256(dictionary.encode("utf-8")).hexdigest()
    (directory / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Ready: {len(characters)} dictionary entries")


if __name__ == "__main__":
    main()
