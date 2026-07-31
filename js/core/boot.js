/* Runs synchronously in <head>, before first paint.

   The theme lives in chrome.storage, which is async, so applyTheme() can only
   run after DOMContentLoaded -- roughly 70ms in. Until then the page painted
   the :root default (#0d1117), meaning every light-mode user saw a dark
   rectangle flash on every single new tab. A new tab is opened dozens of times
   a day, so this was the most-repeated visual event in the product.

   StorageManager mirrors the two values needed for first paint into
   localStorage, which IS synchronous, so this can set them before anything
   is drawn. It is deliberately tiny and dependency-free: it must never be the
   reason a new tab is slow. */
'use strict';
(function () {
  try {
    var raw = localStorage.getItem('et_boot');
    if (!raw) return;
    var b = JSON.parse(raw);
    var root = document.documentElement;

    if (typeof b.pageBg === 'string' && /^#[0-9a-f]{3,6}$/i.test(b.pageBg)) {
      root.style.setProperty('--page-bg', b.pageBg);
    }
    if (b.mode === 'light' || b.mode === 'dark') {
      root.style.colorScheme = b.mode;
      root.classList.add('boot-' + b.mode);
    }
  } catch (e) { /* first run, or storage disabled -- fall through to defaults */ }
})();
