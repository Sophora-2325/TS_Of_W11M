(async () => {
  const ipc = window.__TAURI_INTERNALS__;
  if (ipc.metadata.currentWindow.label !== "main") throw new Error("Expected settings window");
  const status = await ipc.invoke("get_ocr_status");
  if (status.model !== "PP-OCRv6 small" || status.state !== "ready") throw new Error(JSON.stringify(status));
  await ipc.invoke("plugin:window|hide", { label: "popup" });
  await ipc.invoke("plugin:window|show", { label: "main" });
  await ipc.invoke("plugin:window|set_focus", { label: "main" });
  document.getElementById("ocr-v6-native-fixture")?.remove();
  const fixture = document.createElement("div");
  fixture.id = "ocr-v6-native-fixture";
  fixture.style.cssText = "position:fixed;left:36px;top:90px;width:650px;padding:20px;background:#fff;color:#111;z-index:2147483647;font:26px/1.8 'Microsoft YaHei',sans-serif;border:2px solid #222;pointer-events:none";
  fixture.textContent = "Hello adventurer Quest complete\n冒险者你好 请接受新的任务\n冒険者よ 新しい世界へ";
  fixture.style.whiteSpace = "pre";
  document.body.appendChild(fixture);
  return { status, fixture: fixture.getBoundingClientRect().toJSON(), hotkey: (await ipc.invoke("get_app_config")).hotkey };
})()
