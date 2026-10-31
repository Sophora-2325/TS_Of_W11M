(async () => {
  const config = await window.__TAURI_INTERNALS__.invoke('get_app_config');
  return {
    window: window.__TAURI_INTERNALS__.metadata.currentWindow.label,
    active: config.activeProfileId,
    savedProfiles: config.profiles.map(p => ({ name: p.name, model: p.model })),
    hasLocalConnectionError: document.body.innerText.includes('请检查本地服务是否启动'),
    hasSaveValidation: document.body.innerText.includes('请填写模型标识'),
    hasUnsavedLocalProfile: document.body.innerText.includes('本地方案 1'),
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth
  };
})()
