(() => {
  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  const headings = [...document.querySelectorAll('h1,h2,h3')].map(
    (h) => h.tagName + ':' + h.textContent.trim().slice(0, 28)
  );
  const links = [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))];
  const imgs = [...document.querySelectorAll('img')].map((i) => ({ src: i.src, alt: i.getAttribute('alt') }));
  const emptyButtons = [...document.querySelectorAll('button')].filter(
    (el) => !el.textContent.trim() && !el.getAttribute('aria-label')
  ).length;
  return JSON.stringify(
    {
      dupIds: [...new Set(dup)],
      headingCount: headings.length,
      h1: headings.filter((h) => h.startsWith('H1')),
      chapterHeads: headings.filter((h) => h.startsWith('H2')).length,
      links,
      imgs,
      emptyButtons,
      title: document.title,
      lang: document.documentElement.lang,
      tables: document.querySelectorAll('table').length,
      forms: document.querySelectorAll('label').length,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth
    },
    null,
    1
  );
})();
