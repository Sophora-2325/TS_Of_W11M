(async () => {
  const ipc = window.__TAURI_INTERNALS__;
  if (ipc.metadata.currentWindow.label !== "popup") throw new Error("Expected popup");
  const status = await ipc.invoke("get_ocr_status");
  const label = document.querySelector(".section-heading p")?.textContent;
  if (status.state !== "ready" || status.model !== "PP-OCRv6 small" || label !== status.model) {
    throw new Error("Final model status or label mismatch");
  }
  return { status, label, fixtureRemoved: !document.getElementById("ocr-v6-native-fixture") };
})()
