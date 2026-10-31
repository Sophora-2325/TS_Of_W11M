import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
try {
  const { engine } = JSON.parse(readFileSync(path.join(root, "src-tauri/local-runtime.json"), "utf8"));
  if (engine.id !== "b11669-vulkan-x64" || engine.executable !== "llama-server.exe") {
    throw new Error("unexpected engine version or executable in local-runtime.json");
  }
  const archive = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, "src-tauri/resources/llama.cpp", `${engine.id}.zip`);
  if (statSync(archive).size !== engine.size) throw new Error("archive size does not match the pinned engine");
  const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
  if (digest !== engine.sha256) throw new Error("archive SHA-256 does not match the pinned engine");
  console.log(`Bundled llama.cpp ${engine.id} verified (${engine.size} bytes, SHA-256 ${digest})`);
} catch (error) {
  console.error(`Bundled engine is not ready (${error.message}). Prepare the pinned ZIP as described in src-tauri/resources/llama.cpp/README.md.`);
  process.exitCode = 1;
}
