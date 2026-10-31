(async () => {
  const ipc = window.__TAURI_INTERNALS__;
  if (ipc.metadata.currentWindow.label !== "popup") throw new Error("Expected popup");
  const text = document.querySelector("textarea")?.value;
  const expected = "Hello adventurer Quest complete\n冒险者你好请接受新的任务\n冒険者よ新しい世界へ";
  if (text !== expected) throw new Error("Unexpected native OCR result");
  const trace = await ipc.invoke("get_capture_trace");
  return {
    exactMatch: true,
    model: await ipc.invoke("get_ocr_status"),
    capture: trace.filter(line => line.includes("phase=ocr-")).slice(-2),
    translationTriggered: false,
  };
})()
