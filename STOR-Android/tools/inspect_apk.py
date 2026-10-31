"""Inspect packaged assets and native ELF layout; does not establish device support."""
import argparse
import hashlib
import json
import struct
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("apk", type=Path)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
models = {}
libraries = []
with zipfile.ZipFile(args.apk) as apk:
    manifest = json.loads(apk.read("assets/models/manifest.json"))
    for entry in manifest["models"]:
        name = entry["role"] + ".onnx"
        digest = hashlib.sha256(apk.read("assets/models/" + name)).hexdigest()
        models[name] = {"sha256": digest, "matches": digest == entry["sha256"]}
    dictionary = hashlib.sha256(apk.read("assets/models/ppocrv6_dict.txt")).hexdigest()
    assert dictionary == manifest["dictionarySha256"], "Dictionary hash mismatch"
    assert all(model["matches"] for model in models.values()), "Model hash mismatch"
    for entry in apk.infolist():
        if not entry.filename.endswith(".so"):
            continue
        data = apk.read(entry)
        assert data[:5] == b"\x7fELF\x02", "Expected ELF64"
        phoff = struct.unpack_from("<Q", data, 32)[0]
        entry_size, count = struct.unpack_from("<HH", data, 54)
        loads = []
        for index in range(count):
            segment = struct.unpack_from("<IIQQQQQQ", data, phoff + index * entry_size)
            if segment[0] == 1:
                loads.append({"align": segment[7], "congruent16k": segment[2] % 16384 == segment[3] % 16384})
        libraries.append({"name": entry.filename, "bytes": entry.file_size, "loadSegments": loads,
                          "elf16k": all(s["align"] >= 16384 and s["congruent16k"] for s in loads)})
report = {"apk": str(args.apk.resolve()), "bytes": args.apk.stat().st_size,
          "sha256": hashlib.sha256(args.apk.read_bytes()).hexdigest(), "models": models,
          "dictionarySha256": dictionary, "libraries": libraries,
          "scope": "Static ELF/model inspection only; no Android runtime verification."}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
assert libraries and all(lib["elf16k"] for lib in libraries), "Native ELF does not meet 16 KB alignment"
