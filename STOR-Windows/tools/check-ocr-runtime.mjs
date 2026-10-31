import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const runtime = path.join(root, "src-tauri/resources/ocr");
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
try {
  for (const file of ["stor-ocr.exe", "_internal/python312.dll", "models/manifest.json", "build-info.json"]) {
    if (!existsSync(path.join(runtime, file))) throw new Error(`missing ${file}`);
  }
  const build = JSON.parse(readFileSync(path.join(runtime, "build-info.json"), "utf8"));
  for (const [file, digest] of Object.entries(build.sources)) {
    if (sha(path.join(root, "ocr-service", file)) !== digest) throw new Error(`stale ${file}`);
  }
  const manifest = JSON.parse(readFileSync(path.join(runtime, "models/manifest.json"), "utf8"));
  if (manifest.name !== "PP-OCRv6 small") throw new Error("unexpected OCR model");
  for (const model of manifest.models) {
    if (!["det", "rec"].includes(model.role) || sha(path.join(runtime, "models", `${model.role}.onnx`)) !== model.sha256) {
      throw new Error("model checksum mismatch");
    }
  }
  if (sha(path.join(runtime, "models/ppocrv6_dict.txt")) !== manifest.dictionarySha256) {
    throw new Error("dictionary checksum mismatch");
  }
  console.log("PP-OCRv6 small runtime verified");
} catch (error) {
  console.error(`OCR runtime is not ready (${error.message}). Run npm run ocr:prepare first.`);
  process.exitCode = 1;
}
