/* platform.js — cross-browser WebExtension shim + CSP-safe favicon helpers.
   Works on Chrome, Edge, Opera, Brave, Vivaldi (chrome.*) and Firefox / Safari (browser.*). */
'use strict';

if (typeof window.$ === 'undefined') {
  window.$ = id => document.getElementById(id);
}
if (typeof window.$$ === 'undefined') {
  window.$$ = sel => document.querySelectorAll(sel);
}

/* One shared escaper. CustomTooltip, CustomSelect and render.js each carried a
   near-identical private copy; this is the strictest of the three (it also
   escapes the apostrophe), so every caller gets equal or safer output. */
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeHref(url) {
  if (!url) return '#';
  const s = String(url).trim();
  if (/^javascript:/i.test(s)) return '#';
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('//') || s.startsWith('chrome') || s.startsWith('about:') || s.startsWith('edge://') || s.startsWith('file://')) return s;
  return 'https://' + s;
}

const IS_EXT_PROTOCOL = typeof location !== 'undefined' && (location.protocol === 'chrome-extension:' || location.protocol === 'moz-extension:');

const EXT = (() => {
  if (!IS_EXT_PROTOCOL) return null;
  try {
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.id) return browser;
  } catch { }
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) return chrome;
  } catch { }
  return null;
})();

const HAS_EXT = (() => {
  try {
    return !!(EXT && EXT.storage && EXT.storage.local);
  } catch { return false; }
})();

function extFaviconUrl(pageUrl) {
  try {
    if (HAS_EXT && EXT.runtime && EXT.runtime.getURL) {
      return EXT.runtime.getURL('_favicon/') + '?pageUrl=' + encodeURIComponent(pageUrl) + '&size=32';
    }
  } catch { }
  return '';
} 
function remoteFaviconsAllowed() {
  try {
    return typeof StorageManager !== 'undefined' &&
           StorageManager.getSettings &&
           StorageManager.getSettings().remoteFavicons === true;
  } catch { return false; }
}

function faviconSrcSet(url) {
  let domain = '';
  try { domain = new URL(url.startsWith('http') ? url : 'https://' + url).hostname; } catch { }
  const chain = [];
  const ext = extFaviconUrl(url);
  if (ext) chain.push(ext);
  if (domain && remoteFaviconsAllowed()) {
    chain.push(`https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=128`);
    chain.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
  }
  const uniq = [...new Set(chain.filter(Boolean))];
  return { src: uniq[0] || '', fallbacks: uniq.slice(1) };
}
function faviconAttr(url) {
  const { src, fallbacks } = faviconSrcSet(url);
  return `src="${src}" data-fav data-fav-fallbacks="${fallbacks.join('|')}"`;
}

const FAVICON_FALLBACK =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
    'stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/>' +
    '<path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/></svg>'
  );

function wireFavicons(root) {
  if (!root) return;
  const imgs = root.matches && root.matches('img[data-fav]') ? [root] : [];
  root.querySelectorAll && root.querySelectorAll('img[data-fav]').forEach(i => imgs.push(i));
  /* Mark the wrapper as well as the image. The app-launcher tile hides the
     broken <img> via `.workspace-icon img.is-fallback` and draws a lettered
     circle via `.workspace-icon.is-fallback::before` -- but the class only ever
     landed on the image, so the icon was hidden and the letter never appeared:
     an empty tile for every app whose favicon is not in the local cache. */
  const markFallback = (img) => {
    img.classList.add('is-fallback');
    img.parentElement?.classList.add('is-fallback');
  };

  imgs.forEach(img => {
    if (img.__faviconWired) return;
    img.__faviconWired = true;
    if (!img.getAttribute('src')) { img.src = FAVICON_FALLBACK; markFallback(img); return; }
    const fbs = (img.getAttribute('data-fav-fallbacks') || '').split('|').filter(Boolean);
    let i = 0;
    img.addEventListener('error', function onErr() {
      if (i < fbs.length) { img.src = fbs[i++]; return; }
      img.removeEventListener('error', onErr);
      img.src = FAVICON_FALLBACK;
      markFallback(img);
    });
  });
}

const CustomTooltip = (() => {
  let tooltipEl = null;
  let showTimeout = null;
  let activeTarget = null;

  function ensureTooltip() {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'et-custom-tooltip';
      tooltipEl.setAttribute('role', 'tooltip');
      const parent = document.body || document.documentElement;
      if (parent) parent.appendChild(tooltipEl);
    }
  }

  function formatTooltipText(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\(([^)]+)\)$/, '<kbd>$1</kbd>');
  }

  function isIconOnly(el) {
    if (el.hasAttribute('data-no-tooltip')) return false;
    if (el.hasAttribute('data-tooltip')) return true;
    const text = (el.textContent || '').replace(/\s+/g, '');
    return text.length <= 2;
  }

  function show(target) {
    if (!isIconOnly(target)) { hide(); return; }

    ensureTooltip();
    if (!tooltipEl || !tooltipEl.parentNode) {
      const parent = document.body || document.documentElement;
      if (parent && tooltipEl) parent.appendChild(tooltipEl);
    }

    if (target.hasAttribute('title')) {
      const titleText = target.getAttribute('title');
      if (titleText) {
        target.setAttribute('data-tooltip', titleText);
        target.removeAttribute('title');
      }
    }

    const text = target.getAttribute('data-tooltip');
    if (!text) { hide(); return; }

    activeTarget = target;
    tooltipEl.innerHTML = formatTooltipText(text);
    tooltipEl.classList.add('visible');

    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();

    let top = rect.top < 100 ? rect.bottom + 8 : rect.top - tooltipRect.height - 8;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));

    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
  }

  function hide() {
    activeTarget = null;
    if (showTimeout) clearTimeout(showTimeout);
    if (tooltipEl) {
      tooltipEl.classList.remove('visible');
    }
  }

  function init() {
    const handleOver = (e) => {
      const target = e.target && e.target.closest ? e.target.closest('[data-tooltip], [title]') : null;
      if (!target) return;
      if (!isIconOnly(target)) { hide(); return; }

      if (activeTarget === target) return;

      if (showTimeout) clearTimeout(showTimeout);
      showTimeout = setTimeout(() => show(target), 250);
    };

    const handleOut = (e) => {
      if (!activeTarget) return;
      if (e.relatedTarget && activeTarget.contains(e.relatedTarget)) {
        return;
      }
      hide();
    };

    /* pointerover/pointerout already cover mouse, pen and touch. Listening for
       mouseover as well meant every hover ran handleOver twice, each doing a
       closest() walk up the tree -- pure duplicate work on a page that is mostly
       hoverable tiles. */
    document.addEventListener('pointerover', handleOver, { passive: true });
    document.addEventListener('focusin', handleOver, { passive: true });

    document.addEventListener('pointerout', handleOut, { passive: true });
    document.addEventListener('focusout', hide, { passive: true });

    document.addEventListener('pointerdown', hide, { passive: true });
    window.addEventListener('scroll', hide, { passive: true });
  }

  return { init, show, hide };
})();

const CustomSelect = (() => {
  function render({ id = '', name = '', value = '', options = [], className = '', style = '' }) {
    const normOptions = options.map(o => (typeof o === 'object' && o !== null ? o : { value: o, label: String(o) }));
    const selectedOpt = normOptions.find(o => String(o.value) === String(value)) || normOptions[0] || { value: '', label: '' };
    const selectedLabel = selectedOpt.label;
    const selectedValue = selectedOpt.value;

    const optsHtml = normOptions.map(o => {
      const isSel = String(o.value) === String(selectedValue);
      return `<div class="et-select-option${isSel ? ' selected' : ''}" data-value="${escapeHtml(o.value)}" role="option" aria-selected="${isSel}"><span>${escapeHtml(o.label)}</span></div>`;
    }).join('');

    return `
      <div class="et-custom-select ${className}" ${id ? `id="${id}"` : ''} ${name ? `data-name="${name}"` : ''} data-value="${escapeHtml(selectedValue)}" ${style ? `style="${style}"` : ''}>
        <button type="button" class="et-select-trigger" aria-haspopup="listbox" aria-expanded="false">
          <span class="et-select-value">${escapeHtml(selectedLabel)}</span>
          <svg class="et-select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div class="et-select-menu" role="listbox">
          ${optsHtml}
        </div>
      </div>
    `;
  }

  function init(container) {
    if (!container) return;
    const root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) return;

    const selects = root.classList && root.classList.contains('et-custom-select') ? [root] : root.querySelectorAll('.et-custom-select');

    selects.forEach(select => {
      if (select._csInitialized) return;
      select._csInitialized = true;

      const trigger = select.querySelector('.et-select-trigger');
      const menu = select.querySelector('.et-select-menu');
      if (!trigger || !menu) return;

      if (!Object.getOwnPropertyDescriptor(select, 'value')) {
        Object.defineProperty(select, 'value', {
          get() {
            return select.dataset.value || '';
          },
          set(val) {
            setValue(select, val, false);
          },
          configurable: true,
          enumerable: true
        });
      }

      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const wasOpen = select.classList.contains('open');
        closeAll();
        if (!wasOpen) {
          select.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });

      menu.addEventListener('click', (e) => {
        const option = e.target.closest('.et-select-option');
        if (!option) return;
        e.stopPropagation();
        const val = option.dataset.value;
        setValue(select, val, true);
        closeAll();
      });
    });
  }

  function initAll(parent = document) {
    init(parent);
  }

  function setValue(select, val, triggerEvent = true) {
    select.dataset.value = val;
    const options = select.querySelectorAll('.et-select-option');
    let foundLabel = '';
    options.forEach(opt => {
      const match = String(opt.dataset.value) === String(val);
      opt.classList.toggle('selected', match);
      opt.setAttribute('aria-selected', match ? 'true' : 'false');
      if (match) {
        foundLabel = opt.textContent.trim();
      }
    });

    const label = select.querySelector('.et-select-value');
    if (label && foundLabel) label.textContent = foundLabel;

    if (triggerEvent) {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function closeAll() {
    document.querySelectorAll('.et-custom-select.open').forEach(s => {
      s.classList.remove('open');
      const t = s.querySelector('.et-select-trigger');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.et-custom-select')) {
        closeAll();
      }
    });

    document.addEventListener('keydown', (e) => {
      const openSelect = document.querySelector('.et-custom-select.open');
      if (!openSelect) return;
      if (e.key === 'Escape') {
        closeAll();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const options = Array.from(openSelect.querySelectorAll('.et-select-option'));
        const currentIdx = options.findIndex(o => o.classList.contains('selected'));
        let nextIdx = currentIdx;
        if (e.key === 'ArrowDown') nextIdx = (currentIdx + 1) % options.length;
        if (e.key === 'ArrowUp') nextIdx = (currentIdx - 1 + options.length) % options.length;
        if (options[nextIdx]) {
          setValue(openSelect, options[nextIdx].dataset.value, true);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        closeAll();
      }
    });
  }

  return { render, init, initAll, setValue, closeAll };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CustomTooltip.init());
} else {
  CustomTooltip.init();
}

