JSON.stringify((() => {
  const cs = getComputedStyle(document.documentElement);
  const prog = document.querySelector('#progress');
  const bar = prog ? prog.parentElement : null;
  const rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)}; };
  const styleOf = sel => { const el = document.querySelector(sel); if (!el) return null; const s = getComputedStyle(el); return {font: s.fontFamily, size: s.fontSize, lh: s.lineHeight, color: s.color, bg: s.backgroundColor, weight: s.fontWeight}; };
  return {
    vw: innerWidth, vh: innerHeight,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    progress: prog ? {styleWidth: prog.style.width, rect: rect(prog), bg: getComputedStyle(prog).backgroundColor, barBg: bar ? getComputedStyle(bar).backgroundColor : null, barRect: rect(bar)} : null,
    topbar: rect(document.querySelector('.topbar')),
    rail: rect(document.querySelector('.rail')),
    doc: rect(document.querySelector('.doc')),
    hero: rect(document.querySelector('.hero')),
    fonts: {
      notoSans: document.fonts.check('16px "Noto Sans SC"'),
      notoSerif: document.fonts.check('16px "Noto Serif SC"'),
      yahei: document.fonts.check('16px "Microsoft YaHei"'),
      body: styleOf('body'),
      h1: styleOf('h1'),
      h2: styleOf('.chapter h2'),
      p: styleOf('.prose p'),
      mono: styleOf('pre, code')
    },
    colors: {
      ink: cs.getPropertyValue('--ink').trim(),
      ink2: cs.getPropertyValue('--ink-2').trim(),
      muted: cs.getPropertyValue('--muted').trim(),
      accent: cs.getPropertyValue('--accent').trim(),
      accentInk: cs.getPropertyValue('--accent-ink').trim(),
      card: cs.getPropertyValue('--card').trim(),
      line: cs.getPropertyValue('--line').trim(),
      bg: cs.getPropertyValue('--bg').trim(),
      pine: cs.getPropertyValue('--pine').trim()
    },
    copyButtons: Array.from(document.querySelectorAll('.copy-btn')).map(b => ({text: b.textContent.trim(), rect: rect(b), visible: !!b.offsetParent})),
    tocOpenVisible: (() => { const b = document.querySelector('#toc-open'); return b ? {display: getComputedStyle(b).display, rect: rect(b)} : null; })(),
    tocDialogOpen: document.querySelector('#toc-dialog').open
  };
})())
