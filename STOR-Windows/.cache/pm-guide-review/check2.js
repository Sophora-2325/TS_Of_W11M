(() => {
  const anchors = [...document.querySelectorAll('a[href^="#"]')]
    .map((a) => a.getAttribute('href').slice(1))
    .filter((id) => id && !document.getElementById(id));
  const labelledby = [...document.querySelectorAll('[aria-labelledby]')]
    .map((el) => ({ tag: el.tagName, value: el.getAttribute('aria-labelledby') }))
    .filter((item) => !document.getElementById(item.value));
  const invalidAriaHiddenFocus = [...document.querySelectorAll('[aria-hidden="true"] a, [aria-hidden="true"] button, [aria-hidden="true"] input')].length;
  return JSON.stringify({ brokenAnchors: [...new Set(anchors)], brokenLabelledby: labelledby, hiddenFocusable: invalidAriaHiddenFocus });
})();
