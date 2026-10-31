(() => {
 if (window.__TAURI_INTERNALS__.metadata.currentWindow.label !== 'popup') throw new Error('Expected popup');
 const button=document.querySelector('.popup-actions button:last-child');
 if (!button || button.disabled) throw new Error('Reselect is not available');
 button.click();
 button.click();
 return 'Clicked reselect twice in the same event turn';
})()
