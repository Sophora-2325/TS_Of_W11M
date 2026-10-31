JSON.stringify((() => {
  const vw = window.innerWidth;
  const de = document.documentElement;
  const skip = el => {
    if (!el || el.nodeType !== 1) return true;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return true;
    if (el.classList.contains('sr-only') || el.closest('.sr-only')) return true;
    if (el.classList.contains('skip')) return true;
    if (cs.position === 'absolute' && (parseFloat(cs.left) < -1000 || parseFloat(cs.top) < -1000)) return true;
    return false;
  };
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    if (skip(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cs = getComputedStyle(el);
    // overflow right
    const rightOver = r.right - vw;
    const leftOver = -r.left;
    if (rightOver > 1.5 || leftOver > 1.5) {
      // ignore descendants of an element that is inside a horizontally scrollable container
      let p = el.parentElement, clipped = false;
      while (p && p !== document.body) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === 'auto' || ps.overflowX === 'scroll' || ps.overflowX === 'hidden') { clipped = true; break; }
        p = p.parentElement;
      }
      offenders.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || '',
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 70),
        rightOver: Math.round(rightOver), leftOver: Math.round(leftOver),
        w: Math.round(r.width), x: Math.round(r.x),
        clippedParent: clipped,
        text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 45)
      });
    }
  }
  return {
    vw, vh: innerHeight,
    scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, bodyScrollWidth: document.body.scrollWidth,
    diff: de.scrollWidth - vw,
    hasHorizontalScrollbar: de.scrollWidth > de.clientWidth + 1,
    total: offenders.length,
    unclipped: offenders.filter(o => !o.clippedParent).slice(0, 20),
    clipped: offenders.filter(o => o.clippedParent).slice(0, 8)
  };
})())
