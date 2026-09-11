"use strict";

if (typeof window.$ === "undefined") {
  window.$ = (id) => document.getElementById(id);
}
if (typeof window.$$ === "undefined") {
  window.$$ = (sel) => document.querySelectorAll(sel);
}

/* Shape and typeface catalogues.
   One table per axis, read by Settings to build its menus, by the theme code
   to apply the choice and by storage to validate an imported profile - so a
   new corner scale or typeface is one entry here rather than four matching
   edits across three files. The first entry of each is the shipped default. */
const CORNER_STYLES = [
  {
    value: "16px",
    label: "Round",
    cls: ["tiles-circle", "radius-round"],
    vars: {
      "--r-xs": "6px",
      "--r-sm": "10px",
      "--r-md": "14px",
      "--r-lg": "16px",
      "--r-xl": "20px",
      "--r-pill": "9999px",
    },
  },
  {
    value: "8px",
    label: "Soft",
    cls: [],
    vars: {
      "--r-xs": "4px",
      "--r-sm": "6px",
      "--r-md": "8px",
      "--r-lg": "10px",
      "--r-xl": "12px",
      "--r-pill": "12px",
    },
  },
  {
    value: "0px",
    label: "Sharp",
    cls: ["radius-sharp"],
    vars: {
      "--r-xs": "0px",
      "--r-sm": "0px",
      "--r-md": "0px",
      "--r-lg": "0px",
      "--r-xl": "0px",
      "--r-pill": "0px",
    },
  },
];

const APP_FONTS = [
  {
    value: "inter",
    label: "Inter",
    stack:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  {
    value: "sans-serif",
    label: "System UI",
    stack:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  { value: "geometric", label: "Outfit", stack: "'Outfit', system-ui, sans-serif" },
  { value: "rounded", label: "Lexend", stack: "'Lexend', system-ui, sans-serif" },
  { value: "serif", label: "Lora", stack: "'Lora', Georgia, serif" },
  { value: "slab", label: "Roboto Slab", stack: "'Roboto Slab', Georgia, serif" },
  { value: "monospace", label: "JetBrains Mono", stack: "'JetBrains Mono', monospace" },
  {
    value: "handwriting",
    label: "Caveat",
    stack: "'Caveat', ui-rounded, cursive",
    cls: "font-handwriting",
  },
];

const CORNER_RADII = CORNER_STYLES.map((c) => c.value);
const APP_FONT_VALUES = APP_FONTS.map((f) => f.value);

/** Resolves a stored choice - including a retired or absent one - to a table entry. */
const cornerStyle = (v) =>
  CORNER_STYLES.find((c) => c.value === v) || CORNER_STYLES[0];
const appFont = (v) => APP_FONTS.find((f) => f.value === v) || APP_FONTS[0];

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setSafeHTML(el, html) {
  if (!el) return;
  const parsed = new DOMParser().parseFromString(
    "<!doctype html><html><body>" + (html || "") + "</body></html>",
    "text/html",
  );
  el.replaceChildren(
    ...Array.from(parsed.body.childNodes, (node) =>
      document.importNode(node, true),
    ),
  );
}

function safeHref(url) {
  if (!url) return "#";
  const s = String(url).trim();
  if (/^javascript:/i.test(s)) return "#";
  if (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("//") ||
    s.startsWith("chrome") ||
    s.startsWith("about:") ||
    s.startsWith("edge://") ||
    s.startsWith("file://")
  )
    return s;
  return "https://" + s;
}
 
let gestureOrigin = null;
document.addEventListener(
  "pointerdown",
  (e) => {
    gestureOrigin = e.target;
  },
  true,
);
["pointerup", "pointercancel"].forEach((evt) =>
  document.addEventListener(
    evt,
    () => {
      // After the click that follows this gesture has been dispatched, so the
      // click handlers still see where the drag started.
      setTimeout(() => {
        gestureOrigin = null;
      }, 0);
    },
    true,
  ),
);

 
function visibleInterval(fn, ms, opts = {}) {
  const leading = opts.leading !== false;
  let id = null;

  const run = () => {
    try {
      fn();
    } catch {}
  };

  const startTimer = () => {
    if (id !== null) return;
    id = setInterval(run, ms);
  };

  const stopTimer = () => {
    if (id === null) return;
    clearInterval(id);
    id = null;
  };

  const sync = () => {
    if (document.visibilityState === "visible") {
      run();
      startTimer();
    } else {
      stopTimer();
    }
  };

  document.addEventListener("visibilitychange", sync);
  if (document.visibilityState === "visible") {
    if (leading) run();
    startTimer();
  }

  return () => {
    document.removeEventListener("visibilitychange", sync);
    stopTimer();
  };
}

function gestureStartedIn(el) {
  return !!(el && gestureOrigin && el.contains(gestureOrigin));
}

function keepOpenFor(el, event) {
  return !!(el && (el.contains(event.target) || gestureStartedIn(el)));
}

const IS_EXT_PROTOCOL =
  typeof location !== "undefined" &&
  (location.protocol === "chrome-extension:" ||
    location.protocol === "moz-extension:");

const EXT = (() => {
  if (!IS_EXT_PROTOCOL) return null;
  try {
    if (typeof browser !== "undefined" && browser.runtime && browser.runtime.id)
      return browser;
  } catch {}
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id)
      return chrome;
  } catch {}
  return null;
})();

const HAS_EXT = (() => {
  try {
    return !!(EXT && EXT.storage && EXT.storage.local);
  } catch {
    return false;
  }
})();

const PermissionManager = (() => {
  const RECOMMENDED = ["tabs", "bookmarks", "history"];
  async function requestRecommended() {
    if (!(HAS_EXT && EXT.permissions?.request)) return false;
    try {
      return !!(await EXT.permissions.request({ permissions: RECOMMENDED }));
    } catch {
      return false;
    }
  }


  return {
    requestRecommended,
  };
})();

let faviconApiState = "unknown";
function probeFaviconApi() {
  if (faviconApiState !== "unknown") return;
  if (!(HAS_EXT && EXT.runtime && EXT.runtime.getURL)) {
    faviconApiState = "unavailable";
    return;
  }

  const settle = (ok) => {
    const next = ok ? "ok" : "unavailable";
    if (faviconApiState === next) return;
    faviconApiState = next;
    if (typeof refreshFavicons === "function") refreshFavicons();
  };

  try {
    if (EXT.permissions && EXT.permissions.contains) {
      Promise.resolve(EXT.permissions.contains({ permissions: ["favicon"] }))
        .then((ok) => settle(!!ok))
        .catch(() => settle(false));
      return;
    }
  } catch {}
  settle(false);
}

function refreshFavicons(root) {
  const scope = root || document;
  scope.querySelectorAll("img[data-fav]").forEach((img) => {
    const url = img.getAttribute("data-fav-url");
    if (!url) return;
    const { src, fallbacks } = faviconSrcSet(url);
    img.classList.remove("is-fallback");
    img.parentElement?.classList.remove("is-fallback");
    img.setAttribute("data-fav-fallbacks", fallbacks.join("|"));
    img.__faviconWired = false;
    img.src = src || FAVICON_FALLBACK;
    if (!src) {
      img.classList.add("is-fallback");
      img.parentElement?.classList.add("is-fallback");
    } else wireFavicons(img);
  });
}

function extFaviconUrl(pageUrl) {
  if (faviconApiState === "unavailable") return "";
  try {
    if (HAS_EXT && EXT.runtime && EXT.runtime.getURL) {
      return (
        EXT.runtime.getURL("_favicon/") +
        "?pageUrl=" +
        encodeURIComponent(pageUrl) +
        "&size=32"
      );
    }
  } catch {}
  return "";
}
function remoteFaviconsAllowed() {
  try {
    return (
      typeof StorageManager !== "undefined" &&
      StorageManager.getSettings &&
      StorageManager.getSettings().remoteFavicons === true
    );
  } catch {
    return false;
  }
}

function faviconSrcSet(url) {
  let origin = "",
    domain = "";
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    origin = u.origin;
    domain = u.hostname;
  } catch {}

  const chain = [];
  const bundledIcons = {
    "youtube.com": "icons/favicons/youtube.svg",
    "www.youtube.com": "icons/favicons/youtube.svg",
    "mail.google.com": "icons/favicons/gmail.svg",
  };
  if (bundledIcons[domain]) {
    try {
      chain.push(
        HAS_EXT && EXT.runtime?.getURL
          ? EXT.runtime.getURL(bundledIcons[domain])
          : bundledIcons[domain],
      );
    } catch {
      chain.push(bundledIcons[domain]);
    }
  }
  const ext = extFaviconUrl(url);
  if (ext) chain.push(ext);
  const allowRemote = remoteFaviconsAllowed();
  if (domain && allowRemote) {
    chain.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
    chain.push(
      `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=128`,
    );
  }
  if (origin && allowRemote && /^https?:$/.test(new URL(origin).protocol)) {
    chain.push(origin + "/favicon.ico");
  }
  const uniq = [...new Set(chain.filter(Boolean))];
  return { src: uniq[0] || "", fallbacks: uniq.slice(1) };
}
function faviconAttr(url) {
  const { src, fallbacks } = faviconSrcSet(url);
  return (
    `src="${src}" data-fav data-fav-url="${String(url).replace(/"/g, "&quot;")}" ` +
    `referrerpolicy="no-referrer" decoding="async" ` +
    `data-fav-fallbacks="${fallbacks.join("|")}"`
  );
}

const FAVICON_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
      'stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/>' +
      '<path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/></svg>',
  );

function wireFavicons(root) {
  if (!root) return;
  const imgs = [];
  if (root.matches && root.matches("img[data-fav]")) imgs.push(root);
  if (root.querySelectorAll)
    root.querySelectorAll("img[data-fav]").forEach((i) => imgs.push(i));

  const markFallback = (img) => {
    img.classList.add("is-fallback");
    img.parentElement?.classList.add("is-fallback");
  };

  const clearFallback = (img) => {
    img.classList.remove("is-fallback");
    img.parentElement?.classList.remove("is-fallback");
  };

  imgs.forEach((img) => {
    if (img.__faviconWired) return;
    img.__faviconWired = true;

    const fbs = (img.getAttribute("data-fav-fallbacks") || "")
      .split("|")
      .filter(Boolean);
    const triedUrls = new Set([img.src]);
    let fbIndex = 0;
    let attempts = 0;

    const tryNextFallback = () => {
      attempts++;
      if (img.src === FAVICON_FALLBACK || attempts > 10) {
        if (img.src !== FAVICON_FALLBACK) img.src = FAVICON_FALLBACK;
        markFallback(img);
        return;
      }

      while (fbIndex < fbs.length) {
        const nextUrl = fbs[fbIndex++];
        if (nextUrl && !triedUrls.has(nextUrl)) {
          triedUrls.add(nextUrl);
          img.src = nextUrl;
          return;
        }
      }

      img.src = FAVICON_FALLBACK;
      markFallback(img);
    };

    const handleLoad = () => {
      if (img.src === FAVICON_FALLBACK) {
        markFallback(img);
      } else {
        clearFallback(img);
      }
    };

    const handleError = () => {
      tryNextFallback();
    };

    img.addEventListener("load", handleLoad, { passive: true });
    img.addEventListener("error", handleError, { passive: true });

    const currentSrc = img.getAttribute("src");
    if (!currentSrc || currentSrc === "") {
      tryNextFallback();
    }
  });
}

const CustomTooltip = (() => {
  let tooltipEl = null;
  let showTimeout = null;
  let activeTarget = null;
  // The element a *pending* reveal is armed for. `activeTarget` is only set
  // once the tooltip is actually on screen, so it cannot tell a leave handler
  // whether there is still a timer in flight - which is how a label for a
  // button the pointer had already left arrived 250ms later and then stayed
  // there, with nothing left to hover off to take it down again.
  let pendingTarget = null;
  // A control the pointer has already used. Clicking a toolbar icon repaints
  // what is under the cursor, which fires a fresh `pointerover` on the button
  // and re-armed the label - so opening the Sessions popover put the words
  // "Saved sessions" back on screen, on top of the panel that had just
  // answered the question. A tooltip explains a control you have not pressed
  // yet; once you press it, it has nothing left to say until you come back.
  let suppressedTarget = null;

  function ensureTooltip() {
    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.className = "et-custom-tooltip";
      tooltipEl.setAttribute("role", "tooltip");
      const parent = document.body || document.documentElement;
      if (parent) parent.appendChild(tooltipEl);
    }
  }

  function formatTooltipText(text) {
    if (!text) return "";
    const compact = text.length > 48 ? text.slice(0, 47).trimEnd() + "…" : text;
    return escapeHtml(compact).replace(/\(([^)]+)\)$/, "<kbd>$1</kbd>");
  }

  function isIconOnly(el) {
    if (el.hasAttribute("data-no-tooltip")) return false;
    if (el.hasAttribute("data-tooltip")) return true;
    const text = (el.textContent || "").replace(/\s+/g, "");
    return text.length <= 2;
  }

  function show(target) {
    if (!isIconOnly(target)) {
      hide();
      return;
    }

    ensureTooltip();
    if (!tooltipEl || !tooltipEl.parentNode) {
      const parent = document.body || document.documentElement;
      if (parent && tooltipEl) parent.appendChild(tooltipEl);
    }

    if (target.hasAttribute("title")) {
      const titleText = target.getAttribute("title");
      if (titleText) {
        target.setAttribute("data-tooltip", titleText);
        target.removeAttribute("title");
      }
    }

    const text = target.getAttribute("data-tooltip");
    if (!text) {
      hide();
      return;
    }

    activeTarget = target;
    pendingTarget = null;
    setSafeHTML(tooltipEl, formatTooltipText(text));
    tooltipEl.classList.add("visible");

    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();

    // Determine available vertical and horizontal space
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = window.innerWidth - rect.right;

    let top;
    // Prefer placing in the side with more available vertical clearance
    if (spaceBelow >= tooltipRect.height + 12 && spaceAbove < 90) {
      top = rect.bottom + 8;
    } else if (spaceAbove >= tooltipRect.height + 12) {
      top = rect.top - tooltipRect.height - 8;
    } else {
      top = rect.bottom + 8;
    }

    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

    // Edge alignment when trigger is in screen corners
    if (rect.left < 80) {
      left = Math.max(12, rect.left);
    } else if (rect.right > window.innerWidth - 80) {
      left = Math.min(window.innerWidth - tooltipRect.width - 12, rect.right - tooltipRect.width);
    }

    left = Math.max(
      10,
      Math.min(left, window.innerWidth - tooltipRect.width - 10),
    );
    top = Math.max(
      8,
      Math.min(top, window.innerHeight - tooltipRect.height - 8),
    );

    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
  }

  function hide() {
    activeTarget = null;
    pendingTarget = null;
    // `suppressedTarget` is deliberately not cleared here: hide() runs on the
    // press itself, and clearing it there would let the repaint that follows
    // re-arm the very label the press was meant to retire.
    if (showTimeout) clearTimeout(showTimeout);
    showTimeout = null;
    if (tooltipEl) {
      tooltipEl.classList.remove("visible");
    }
  }

  function init() {
    const handleOver = (e) => {
      const target =
        e.target && e.target.closest
          ? e.target.closest("[data-tooltip], [title]")
          : null;
      if (!target) return;
      if (!isIconOnly(target)) {
        hide();
        return;
      }

      if (activeTarget === target) return;
      if (suppressedTarget === target) return;

      if (showTimeout) clearTimeout(showTimeout);
      pendingTarget = target;
      showTimeout = setTimeout(() => {
        // The pointer can leave during the delay, and on a fast pass across a
        // toolbar it usually does. Only reveal if this is still the element
        // being pointed at - or keyboard-focused, which is the other way a
        // tooltip is asked for. Fails open: if the engine cannot answer the
        // question, show the label, because a tooltip that occasionally
        // arrives late is a much smaller problem than one that never arrives.
        if (pendingTarget !== target) return;
        if (!target.isConnected) {
          pendingTarget = null;
          return;
        }
        let stillWanted = true;
        try {
          stillWanted =
            target.matches(":hover") || target.matches(":focus-visible");
        } catch {
          stillWanted = true;
        }
        if (!stillWanted) {
          pendingTarget = null;
          return;
        }
        show(target);
      }, 250);
    };

    const handleOut = (e) => {
      // Leaving the control it was pressed on is what makes it explainable
      // again, so the suppression is lifted here rather than on a timer.
      if (
        suppressedTarget &&
        !(e.relatedTarget && suppressedTarget.contains(e.relatedTarget))
      ) {
        suppressedTarget = null;
      }

      const leaving = activeTarget || pendingTarget;
      if (!leaving) return;
      if (e.relatedTarget && leaving.contains(e.relatedTarget)) {
        return;
      }
      hide();
    };

    const handleDown = (e) => {
      const target =
        e.target && e.target.closest
          ? e.target.closest("[data-tooltip], [title]")
          : null;
      suppressedTarget = target || null;
      hide();
    };

    document.addEventListener("pointerover", handleOver, { passive: true });
    document.addEventListener("focusin", handleOver, { passive: true });

    document.addEventListener("pointerout", handleOut, { passive: true });
    document.addEventListener("focusout", hide, { passive: true });

    document.addEventListener("pointerdown", handleDown, { passive: true });
    window.addEventListener("scroll", hide, { passive: true });
    // A pointer that leaves the window entirely fires no `pointerout` for the
    // element it was last over, and a tab switched away mid-hover comes back
    // with the label still painted over the page.
    document.addEventListener("pointerleave", hide, { passive: true });
    window.addEventListener("blur", hide, { passive: true });
    document.addEventListener("visibilitychange", hide, { passive: true });
  }

  return { init, show, hide };
})();

/**
 * Slides a container between its measured height and 0 - the collapse/expand
 * motion shared by board cards and settings accordions. Both used to have
 * their own copy: the board version measured height and recovered from an
 * interrupted click correctly, the settings version was a bare `display`
 * toggle with no animation at all, so an accordion's own chevron glided
 * while its body snapped. One implementation now backs both.
 *
 * Height is animated explicitly rather than left to CSS, because the two
 * things CSS cannot do here are exactly the two that break a naive attempt:
 * measure `auto`, and recover when a slide is interrupted. An interrupted
 * slide is the common case - click the header twice quickly and the second
 * click arrives mid-flight - so the animation always starts from the height
 * the element is at *right now*, never from a nominal 0 or a remembered
 * target. That is what removes the flicker.
 *
 * On arrival the inline height is dropped and the resting CSS state takes
 * over, so an expanded element reflows with its content afterwards instead
 * of being frozen at whatever it measured once.
 *
 * @param {HTMLElement} body The element whose height slides. Give it
 *   `height: 0; overflow: hidden` at rest (collapsed) and `height: auto` when
 *   an `is-expanded`-style class is present, the same way board cards do.
 * @param {boolean} open Slide open (true) or shut (false).
 * @param {string} animatingClass Class applied for the duration of the slide,
 *   e.g. to force `overflow: hidden` and hint `will-change` while in flight.
 * @param {number|null} knownFrom The height to slide *from*, measured by the
 *   caller before it flipped whatever class drives the CSS resting state.
 *   Every caller here toggles an `is-expanded` class (for the chevron, aria
 *   state, and so on) and only then triggers the slide - by that point the
 *   CSS rule for the new state is already active, so measuring `from` inside
 *   this function would read the height the element is *becoming*, not the
 *   one it *was*. That made every "open" slide measure a from/to gap of
 *   ~0 and skip straight to the end with no animation, while "close" (which
 *   does not depend on a class flip to know its target - the target is
 *   always 0) happened to work. Pass the pre-toggle height to sidestep it.
 */
function slideHeight(body, open, animatingClass = "is-animating", knownFrom = null) {
  if (!body) return;

  const motionOk = !window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  const dur =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--dur-3"),
    ) || 300;

  // Cancel whatever was in flight; `getBoundingClientRect` then reports the
  // real current height, mid-slide included - used only when the caller has
  // not supplied a pre-toggle measurement of its own.
  body.__slide?.cancel();

  let guard = null;
  let anim = null;
  const settle = () => {
    clearTimeout(guard);
    // Releasing the forwards-fill is part of settling, not just something the
    // `finish` handler does. The fill outranks the stylesheet, so an animation
    // left filled pins the element at its last animated height and the resting
    // CSS - `height: auto` for an open board - never gets to apply.
    //
    // The guard path is where this bit: it settled without cancelling and then
    // cleared `__slide`, so the still-filled animation was unreachable for
    // good. A board toggled again mid-slide could end up flagged open, with
    // its contents laid out, and stuck at zero height.
    if (anim) {
      try {
        anim.cancel();
      } catch {}
      anim = null;
    }
    body.classList.remove(animatingClass);
    body.style.height = "";
    body.style.overflow = "";
    body.__slide = null;
  };

  if (!motionOk || dur <= 0) {
    settle();
    return;
  }

  const from =
    typeof knownFrom === "number" ? knownFrom : body.getBoundingClientRect().height;
  // Measured while the element is laid out but before it is clamped, so the
  // target is the content's real height rather than the current one.
  body.classList.add(animatingClass);
  body.style.height = "auto";
  const to = open ? body.getBoundingClientRect().height : 0;
  body.style.height = `${from}px`;

  if (Math.abs(to - from) < 1) {
    settle();
    return;
  }

  anim = body.animate([{ height: `${from}px` }, { height: `${to}px` }], {
    duration: dur,
    // The same deceleration curve as --ease-out (cubic-bezier(0.16, 1, 0.3,
    // 1)) rather than a hand-picked one: this motion and the CSS opacity fade
    // that runs alongside it (board cards, accordion chevrons) used to ease
    // differently and finish at different times, which read as a stutter
    // even though nothing was actually broken.
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    fill: "forwards",
  });

  // Held separately from `anim`, which `settle` clears: the listeners below
  // outlive that and must still refer to their own animation rather than to
  // whatever (or nothing) the variable points at by the time they run.
  const thisAnim = anim;
  body.__slide = thisAnim;

  // A `finish` event that never arrives is the failure this whole approach
  // exists to rule out: an animation frame loop that is throttled or stopped
  // (a background tab, a window that is not compositing) leaves the element
  // pinned at its inline height forever. It settles on a wall-clock timer
  // regardless, landing on the resting CSS state either way - and `settle`
  // now releases the fill, so that path cannot strand a filled animation.
  guard = setTimeout(settle, dur + 120);

  thisAnim.addEventListener("finish", () => {
    // `settle` does the cancelling, which releases the forwards-fill so the
    // resting CSS state - `height: auto` for an open element - is what remains.
    settle();
  });
  thisAnim.addEventListener("cancel", () => {
    if (body.__slide === thisAnim) body.__slide = null;
  });
}

const CustomSelect = (() => {
  function render({
    id = "",
    name = "",
    value = "",
    options = [],
    className = "",
    style = "",
  }) {
    const normOptions = options.map((o) =>
      typeof o === "object" && o !== null ? o : { value: o, label: String(o) },
    );
    const selectedOpt = normOptions.find(
      (o) => String(o.value) === String(value),
    ) ||
      normOptions[0] || { value: "", label: "" };
    const selectedLabel = selectedOpt.label;
    const selectedValue = selectedOpt.value;

    /* A filter earns its place once the list is longer than a glance. At five
       it was appearing on menus you could read in full without scrolling, which
       cost a row of height and made a short list look like a database. */
    const showSearch = normOptions.length > 9;
    const searchHtml = showSearch
      ? `<div class="et-select-search-wrap"><input type="text" class="et-select-search" placeholder="Search options…" autocomplete="off" /></div>`
      : "";

    const optsHtml = normOptions
      .map((o) => {
        const isSel = String(o.value) === String(selectedValue);
        return `<div class="et-select-option${isSel ? " selected" : ""}" data-value="${escapeHtml(o.value)}" role="option" aria-selected="${isSel}"><span>${escapeHtml(o.label)}</span></div>`;
      })
      .join("");

    return `
      <div class="et-custom-select ${className}" ${id ? `id="${id}"` : ""} ${name ? `data-name="${name}"` : ""} data-value="${escapeHtml(selectedValue)}" ${style ? `style="${style}"` : ""}>
        <button type="button" class="et-select-trigger" aria-haspopup="listbox" aria-expanded="false">
          <span class="et-select-value">${escapeHtml(selectedLabel)}</span>
          <svg class="et-select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div class="et-select-menu" role="listbox">
          ${searchHtml}
          <div class="et-select-options-list">${optsHtml}</div>
        </div>
      </div>
    `;
  }

  function init(container) {
    if (!container) return;
    const root =
      typeof container === "string"
        ? document.querySelector(container)
        : container;
    if (!root) return;

    const selects =
      root.classList && root.classList.contains("et-custom-select")
        ? [root]
        : root.querySelectorAll(".et-custom-select");

    selects.forEach((select) => {
      if (select._csInitialized) return;
      select._csInitialized = true;

      const trigger = select.querySelector(".et-select-trigger");
      const menu = select.querySelector(".et-select-menu");
      if (!trigger || !menu) return;

      const searchInput = select.querySelector(".et-select-search");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          const q = e.target.value.toLowerCase().trim();
          const opts = select.querySelectorAll(".et-select-option");
          opts.forEach((opt) => {
            const txt = opt.textContent.toLowerCase();
            opt.style.display = txt.includes(q) ? "" : "none";
          });
        });
        searchInput.addEventListener("click", (e) => e.stopPropagation());
        searchInput.addEventListener("keydown", (e) => e.stopPropagation());
      }

      if (!Object.getOwnPropertyDescriptor(select, "value")) {
        Object.defineProperty(select, "value", {
          get() {
            return select.dataset.value || "";
          },
          set(val) {
            setValue(select, val, false);
          },
          configurable: true,
          enumerable: true,
        });
      }

      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const wasOpen = select.classList.contains("open");
        closeAll();
        if (!wasOpen) {
          select.classList.add("open");
          trigger.setAttribute("aria-expanded", "true");
          requestAnimationFrame(() => {
            if (!select.classList.contains("open")) return;
            if (searchInput) {
              searchInput.value = "";
              select.querySelectorAll(".et-select-option").forEach((opt) => {
                opt.style.display = "";
              });
              searchInput.focus();
            }
            select.classList.remove("open-up");
            const menuRect = menu.getBoundingClientRect();
            const triggerRect = trigger.getBoundingClientRect();
            const scrollHost = select.closest(".et-set-body");
            const hostRect = scrollHost?.getBoundingClientRect();
            const topLimit = hostRect?.top ?? 0;
            const bottomLimit = hostRect?.bottom ?? window.innerHeight;
            const below = bottomLimit - triggerRect.bottom;
            const above = triggerRect.top - topLimit;
            if (menuRect.height > below && above > below) {
              select.classList.add("open-up");
            }
          });
        }
      });

      menu.addEventListener("click", (e) => {
        const option = e.target.closest(".et-select-option");
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
    const options = select.querySelectorAll(".et-select-option");
    let foundLabel = "";
    options.forEach((opt) => {
      const match = String(opt.dataset.value) === String(val);
      opt.classList.toggle("selected", match);
      opt.setAttribute("aria-selected", match ? "true" : "false");
      if (match) {
        foundLabel = opt.textContent.trim();
      }
    });

    const label = select.querySelector(".et-select-value");
    if (label && foundLabel) label.textContent = foundLabel;

    if (triggerEvent) {
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function closeAll() {
    document.querySelectorAll(".et-custom-select.open").forEach((s) => {
      s.classList.remove("open");
      s.classList.remove("open-up");
      const t = s.querySelector(".et-select-trigger");
      if (t) t.setAttribute("aria-expanded", "false");
    });
  }

  if (typeof document !== "undefined") {
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".et-custom-select")) {
        closeAll();
      }
    });

    document.addEventListener("keydown", (e) => {
      const openSelect = document.querySelector(".et-custom-select.open");
      if (!openSelect) return;
      if (e.key === "Escape") {
        closeAll();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const options = Array.from(
          openSelect.querySelectorAll(".et-select-option"),
        );
        const currentIdx = options.findIndex((o) =>
          o.classList.contains("selected"),
        );
        let nextIdx = currentIdx;
        if (e.key === "ArrowDown") nextIdx = (currentIdx + 1) % options.length;
        if (e.key === "ArrowUp")
          nextIdx = (currentIdx - 1 + options.length) % options.length;
        if (options[nextIdx]) {
          setValue(openSelect, options[nextIdx].dataset.value, true);
          try {
            options[nextIdx].scrollIntoView({ block: "nearest" });
          } catch {}
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        closeAll();
      }
    });
  }

  return { render, init, initAll, setValue, closeAll };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    CustomTooltip.init();
    probeFaviconApi();
  });
} else {
  CustomTooltip.init();
  probeFaviconApi();
}

/**
 * Single registry for the top-bar popovers (sessions, workspace, logo
 * menu).
 *
 * Each popover used to close itself from its own document-click listener while
 * its trigger button called `stopPropagation()`. That combination meant
 * opening one popover never closed the others, so clicking Sessions with the
 * tasks popover open simply left both on screen. Opening now goes through here,
 * which closes every other registered popover first.
 */
const PopoverRegistry = (() => {
  const entries = [];
  let listening = false;

  /**
   * @param {string} name Stable id, used for `closeAll(except)`.
   * @param {() => HTMLElement|null} el Resolves the popover element.
   * @param {() => void} close Closes this popover.
   */
  function register(name, el, close) {
    if (entries.some((e) => e.name === name)) return;
    entries.push({ name, el, close });

    if (listening) return;
    listening = true;
    document.addEventListener("click", (event) => {
      entries.forEach((entry) => {
        const node = entry.el();
        if (!node || !node.classList.contains("open")) return;
        if (keepOpenFor(node, event)) return;
        if (event.target.closest?.(`[data-popover-trigger="${entry.name}"]`))
          return;
        entry.close();
      });
    });
  }

  /**
   * Anchors a popover to its trigger, clamped into the viewport.
   *
   * Flips above the trigger in the lower half of the screen so a popover
   * opened from a bottom-row button is not pinned off-screen.
   *
   * @param {HTMLElement} pop The popover.
   * @param {HTMLElement} btn The trigger it hangs off.
   * @param {{width?: number, align?: "left"|"right"}} [opts]
   */
  function position(pop, btn, opts = {}) {
    const { width = 340, align = "left" } = opts;
    const r = btn.getBoundingClientRect();

    if (align === "right") {
      pop.style.left = "auto";
      pop.style.right = `${Math.max(16, window.innerWidth - r.right)}px`;
    } else {
      pop.style.right = "auto";
      pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - width))}px`;
    }

    if (r.top > window.innerHeight / 2) {
      pop.style.top = "auto";
      pop.style.bottom = `${Math.max(8, window.innerHeight - r.top + 8)}px`;
    } else {
      pop.style.bottom = "auto";
      pop.style.top = `${r.bottom + 8}px`;
    }
  }

  function closeAll(except) {
    entries.forEach((entry) => {
      if (entry.name === except) return;
      if (entry.el()?.classList.contains("open")) entry.close();
    });
  }

  /** Closes the topmost open popover. Returns true when one was closed. */
  function closeTop() {
    const open = entries.filter((e) => e.el()?.classList.contains("open"));
    if (!open.length) return false;
    open[open.length - 1].close();
    return true;
  }

  function anyOpen() {
    return entries.some((e) => e.el()?.classList.contains("open"));
  }

  return { register, position, closeAll, closeTop, anyOpen };
})();

/**
 * Colour contrast, in one place.
 *
 * Built on APCA (the Accessible Perceptual Contrast Algorithm behind the
 * WCAG 3 draft) rather than WCAG 2's (L1+0.05)/(L2+0.05) ratio. The old ratio
 * is symmetric and famously wrong at the ends of the range: it calls white on
 * mid-orange a comfortable pass and near-black on dark grey a fail, when your
 * eye says the opposite. APCA is polarity-aware - dark-on-light and
 * light-on-dark are scored by different curves, because they genuinely do not
 * read the same - which is exactly the judgement this app has to make every
 * time a user picks an accent.
 *
 * Everything is a handful of pow() calls on three channels, so it is cheap
 * enough to run per repaint.
 *
 * Reading Lc: |Lc| 90 is the strongest pairing, 75 is comfortable body text,
 * 60 is the practical floor for body copy, 45 for large or bold text, and 30
 * is about the limit for anything meant to be read at all.
 */
const Contrast = (() => {
  // Constants from APCA 0.98G-4g. They are a matched set; changing one alone
  // does not produce a "slightly different" answer, it produces a wrong one.
  const C = {
    scale: 1.14,
    loConOffset: 0.027,
    loClip: 0.001,
    Ntx: 0.57,
    Nbg: 0.56,
    Rtx: 0.62,
    Rbg: 0.65,
    blkThrs: 0.022,
    blkClmp: 1.414,
    deltaYmin: 0.0005,
  };

  const INK_DARK = "#14151a";
  const INK_LIGHT = "#ffffff";

  function toRgb(color) {
    let c = String(color || "").trim();
    const m = c.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      const [r, g, b] = m[1].split(",").map((v) => parseFloat(v));
      return { r: r || 0, g: g || 0, b: b || 0 };
    }
    c = c.replace("#", "");
    if (c.length === 3)
      c = c
        .split("")
        .map((x) => x + x)
        .join("");
    const n = parseInt(c.slice(0, 6), 16);
    return Number.isNaN(n)
      ? { r: 0, g: 0, b: 0 }
      : { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  const toHex = ({ r, g, b }) =>
    "#" +
    ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b))
      .toString(16)
      .slice(1);

  /** Screen luminance Y - APCA's simple 2.4 power curve, not WCAG's piecewise. */
  function lum(color) {
    const { r, g, b } = toRgb(color);
    const p = (v) => Math.pow(v / 255, 2.4);
    return 0.2126729 * p(r) + 0.7151522 * p(g) + 0.072175 * p(b);
  }

  /**
   * @returns {number} Lc, roughly -108..106. The sign is polarity (negative is
   *   light text on dark); the magnitude is readability.
   */
  function lc(textColor, bgColor) {
    const soft = (y) =>
      y < C.blkThrs ? y + Math.pow(C.blkThrs - y, C.blkClmp) : y;
    const txt = soft(lum(textColor));
    const bg = soft(lum(bgColor));
    if (Math.abs(bg - txt) < C.deltaYmin) return 0;

    let out;
    if (bg > txt) {
      out = (Math.pow(bg, C.Nbg) - Math.pow(txt, C.Ntx)) * C.scale;
      out = out < C.loClip ? 0 : out - C.loConOffset;
    } else {
      out = (Math.pow(bg, C.Rbg) - Math.pow(txt, C.Rtx)) * C.scale;
      out = out > -C.loClip ? 0 : out + C.loConOffset;
    }
    return out * 100;
  }

  /** Whichever of near-black / white reads better on `bg`. */
  function ink(bg) {
    return Math.abs(lc(INK_DARK, bg)) >= Math.abs(lc(INK_LIGHT, bg))
      ? INK_DARK
      : INK_LIGHT;
  }

  /** True when `bg` is light enough to want dark ink on it. */
  const isLight = (bg) => ink(bg) === INK_DARK;

  // sRGB <-> OkLCH (Bjorn Ottosson's OkLab), so a colour's lightness can move
  // while its chroma and hue stay where they are.
  const linear = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const gamma = (v) =>
    255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

  function toOklch(color) {
    const { r, g, b } = toRgb(color);
    const R = linear(r),
      G = linear(g),
      B = linear(b);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return { L, C: Math.hypot(A, Bb), h: Math.atan2(Bb, A) };
  }

  function oklchToLinear(L, C, h) {
    const A = C * Math.cos(h),
      Bb = C * Math.sin(h);
    const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * Bb, 3);
    const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * Bb, 3);
    const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * Bb, 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  }

  /** The colour at this lightness and hue, giving up chroma only if it must. */
  function fromOklch(L, C, h) {
    let c = C;
    for (let i = 0; i < 30; i++) {
      const rgb = oklchToLinear(L, c, h);
      if (rgb.every((v) => v >= -0.001 && v <= 1.001) || c < 0.002) {
        const [r, g, b] = rgb.map((v) => gamma(Math.min(1, Math.max(0, v))));
        return toHex({ r, g, b });
      }
      c *= 0.9;
    }
    const [r, g, b] = oklchToLinear(L, 0, h).map((v) =>
      gamma(Math.min(1, Math.max(0, v))),
    );
    return toHex({ r, g, b });
  }

  /**
   * Keeps a colour you *want* while making it legible on the ground it sits
   * on. Used for accent-coloured text: the hue survives, only its lightness
   * moves, and only as far as it has to.
   *
   * Walks lightness toward whichever ink `bg` calls for, in OkLCH, and stops
   * the moment it clears `minLc`. It used to mix toward the ink in sRGB, which
   * drains chroma on the way - a pastel pink darkened that way arrived as a
   * dusty mauve, which is the "dull" accent. Moving lightness alone keeps the
   * colour as saturated as the screen can show it at that lightness.
   *
   * @param {string} color Colour to preserve.
   * @param {string} bg    Ground it will be read against.
   * @param {number} minLc Target |Lc| - 60 body, 45 large text.
   */
  function readable(color, bg, minLc = 60) {
    if (Math.abs(lc(color, bg)) >= minLc) return toHex(toRgb(color));

    const { L, C, h } = toOklch(color);
    const targetL = ink(bg) === INK_DARK ? 0 : 1;
    let best = toHex(toRgb(color));
    let bestLc = Math.abs(lc(color, bg));

    for (let step = 1; step <= 40; step++) {
      const candidate = fromOklch(L + (targetL - L) * (step / 40), C, h);
      const got = Math.abs(lc(candidate, bg));
      if (got > bestLc) {
        bestLc = got;
        best = candidate;
      }
      if (got >= minLc) return candidate;
    }
    // Nothing on the line cleared the bar, so hand back the closest it got.
    return best;
  }

  function toHsl(color) {
    const { r, g, b } = toRgb(color);
    const rn = r / 255,
      gn = g / 255,
      bn = b / 255;
    const mx = Math.max(rn, gn, bn),
      mn = Math.min(rn, gn, bn);
    const l = (mx + mn) / 2;
    const d = mx - mn;
    let h = 0,
      s = 0;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
      else if (mx === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  }

  function fromHsl({ h, s, l }) {
    if (!s) {
      const v = Math.round(l * 255);
      return toHex({ r: v, g: v, b: v });
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const chan = (t) => {
      t = (t + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const hn = h / 360;
    return toHex({
      r: chan(hn + 1 / 3) * 255,
      g: chan(hn) * 255,
      b: chan(hn - 1 / 3) * 255,
    });
  }

  /* Comfortable chroma and lightness bands for a decorative tint - a board
     colour, a chip, a category dot. Well short of the pure hues a colour
     picker hands back: a fully saturated #ef4444 sitting next to text is what
     makes a palette feel shouty, and the same hue at 58% chroma still reads
     unmistakably as "the red board". */
  const TINT = {
    dark: { chroma: 0.58, lo: 0.5, hi: 0.66 },
    light: { chroma: 0.52, lo: 0.4, hi: 0.55 },
  };

  /**
   * Softens a chosen colour into something that can carry a surface without
   * fighting the text on it, in the mode it will actually be seen in.
   *
   * The hue is left alone - that is the whole identity of the choice - while
   * chroma is capped and lightness is pulled into a band that works against
   * the current ground. Dark mode wants the tint lighter than its ground;
   * light mode wants it darker. Deriving both from one seed is what lets a
   * board keep the same colour across a theme switch instead of needing two
   * stored values, or looking neon in one of them.
   */
  function tint(color, mode = "dark") {
    const band = TINT[mode] || TINT.dark;
    const { h, s, l } = toHsl(color);
    return fromHsl({
      h,
      s: Math.min(s, band.chroma),
      l: Math.min(band.hi, Math.max(band.lo, l)),
    });
  }

  return {
    lc,
    lum,
    ink,
    isLight,
    readable,
    tint,
    toRgb,
    toHex,
    toHsl,
    fromHsl,
    INK_DARK,
    INK_LIGHT,
  };
})();
