JSON.stringify((() => {
  const p = document.querySelector('#progress');
  const par = p ? p.parentElement : null;
  const r = p ? p.getBoundingClientRect() : null;
  const cs = p ? getComputedStyle(p) : null;
  return {
    html: par ? par.outerHTML.slice(0, 400) : null,
    tag: p ? p.tagName : null,
    styleProp: p ? p.style.cssText : null,
    rect: r ? {x: r.x, y: r.y, w: r.width, h: r.height} : null,
    cs: cs ? {display: cs.display, position: cs.position, width: cs.width, height: cs.height, transition: cs.transition, bg: cs.backgroundColor} : null,
    parentRect: par ? (() => { const q = par.getBoundingClientRect(); return {x: q.x, y: q.y, w: q.width, h: q.height}; })() : null,
    parentCs: par ? (() => { const q = getComputedStyle(par); return {position: q.position, width: q.width, height: q.height, overflow: q.overflow}; })() : null
  };
})())
