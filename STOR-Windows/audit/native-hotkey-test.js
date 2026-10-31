(async () => {
 const ipc=window.__TAURI_INTERNALS__;
 const original=await ipc.invoke('get_app_config');
 const out={before:original.hotkey};
 try {
   try { await ipc.invoke('set_app_config_and_hotkey',{config:{...original,hotkey:'NotAValidHotkey'}}); } catch(e) {out.saveError=String(e);}
   out.afterFailedSave=(await ipc.invoke('get_app_config')).hotkey;
   out.originalStillRegistered=await ipc.invoke('plugin:global-shortcut|is_registered',{shortcut:original.hotkey});
 } finally {await ipc.invoke('set_app_config_and_hotkey',{config:original});out.restored=(await ipc.invoke('get_app_config')).hotkey;}
 return out;
})()
