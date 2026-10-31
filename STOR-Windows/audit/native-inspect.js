(async () => {
 const ipc = window.__TAURI_INTERNALS__;
 return {label:ipc.metadata.currentWindow.label,config:await ipc.invoke('get_app_config'),hasApiKey:await ipc.invoke('check_api_key'),url:location.href};
})()
