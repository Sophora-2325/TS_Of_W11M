(async () => {
  const ids = ['overview','wishes','glossary','usage','limits','scope','metrics','gates','quiz'];
  const rows = [];
  const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const snap = (id) => {
    const cur = document.querySelector('#rail-list a[aria-current="location"]');
    const p = document.querySelector('#progress');
    return {
      id: id,
      current: cur ? cur.getAttribute('href') : null,
      readout: document.querySelector('#readout') ? document.querySelector('#readout').textContent : null,
      bar: p ? p.style.width : null,
      barRectW: p ? Math.round(p.getBoundingClientRect().width) : null,
      y: Math.round(window.scrollY)
    };
  };
  for (const id of ids) {
    const el = document.getElementById(id);
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 120), behavior: 'instant' });
    await wait();
    rows.push(snap(id));
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
  await wait();
  rows.push(snap('top'));
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  await wait();
  rows.push(snap('bottom'));
  return JSON.stringify(rows);
})()
