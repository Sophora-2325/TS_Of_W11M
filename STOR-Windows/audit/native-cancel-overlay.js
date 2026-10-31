(() => {
 if (window.__TAURI_INTERNALS__.metadata.currentWindow.label !== 'overlay') throw new Error('Expected overlay');
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 return 'Dispatched Escape to the real overlay key handler';
})()
