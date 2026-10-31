JSON.stringify((() => {
  const d = document.querySelector('#toc-dialog');
  const ae = document.activeElement;
  const r = d.getBoundingClientRect();
  const opener = document.querySelector('#toc-open');
  return {
    open: d.open,
    hasAriaModal: d.hasAttribute('aria-modal'),
    role: d.getAttribute('role'),
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    active: { tag: ae.tagName, id: ae.id, cls: (typeof ae.className === 'string' ? ae.className : '').slice(0, 50), text: (ae.innerText || '').replace(/\s+/g, ' ').slice(0, 40) },
    opener: { ariaExpanded: opener.getAttribute('aria-expanded'), ariaControls: opener.getAttribute('aria-controls'), ariaHaspopup: opener.getAttribute('aria-haspopup') },
    scrollY: Math.round(window.scrollY),
    hash: location.hash,
    bodyOverflow: getComputedStyle(document.body).overflow,
    viewport: innerWidth + 'x' + innerHeight,
    backdropPoint: (() => { const el = document.elementFromPoint(8, Math.round(innerHeight / 2)); return el ? { tag: el.tagName, id: el.id, cls: (typeof el.className === 'string' ? el.className : '').slice(0, 40) } : null; })()
  };
})())
