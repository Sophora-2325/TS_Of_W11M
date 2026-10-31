(async () => {
 const ipc=window.__TAURI_INTERNALS__;
 const labels=await ipc.invoke('plugin:window|get_all_windows');
 return {labels,overlayVisible:await ipc.invoke('plugin:window|is_visible',{label:'overlay'})};
})()
