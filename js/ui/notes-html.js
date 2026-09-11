"use strict";

/**
 * Note content sanitiser.
 *
 * The notepad stores HTML now, and that HTML is written straight back into the
 * page. It can arrive from an imported backup or a synced profile as easily as
 * from the keyboard, so it is treated as untrusted every time it is rendered.
 *
 * An allowlist rather than a blocklist: unknown elements are unwrapped (their
 * text survives), and every attribute except the handful listed here is
 * dropped - which is what stops `<img onerror>` and `javascript:` hrefs.
 */
const NoteHTML = (() => {
  const ALLOWED = new Set([
    "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL",
    "P", "DIV", "BR", "SPAN",
    "H1", "H2", "H3",
    "UL", "OL", "LI",
    "BLOCKQUOTE", "CODE", "PRE", "A",
  ]);
  // Per-tag attribute allowlist. Everything else goes, `on*` handlers included.
  const ATTRS = {
    A: ["href", "target", "rel"],
    LI: ["data-checked"],
    UL: ["class"],
    SPAN: ["class"],
  };

  /**
   * Text colour and highlight are stored as class names, never as inline
   * styles.
   *
   * `style` is the obvious way to colour a run of text and the wrong one here.
   * Allowing it through the sanitiser would mean accepting arbitrary CSS from
   * anything that can reach a note - a paste, an imported backup, a synced
   * profile - and `style` carries far more than colour: `position: fixed`,
   * `url()`, `content`, transforms. A note could quietly paint over the rest
   * of the interface.
   *
   * A fixed vocabulary of class names cannot do any of that. It also gets the
   * behaviour the colours actually want: the class resolves to a different hex
   * in light and dark mode, so a note coloured at midnight is still legible at
   * noon. An inline `#7ee081` would not be.
   */
  const COLOR_TOKENS = [
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "grey",
    // "none" is a real state, not the absence of one: it has to be able to
    // override a colour applied to an enclosing span.
    "none",
  ];

  // The only class names notes are allowed to carry, so a stored class cannot
  // reach into the rest of the app's styles.
  const CLASSES = new Set([
    "et-note-checklist",
    ...COLOR_TOKENS.map((t) => "et-note-fg-" + t),
    ...COLOR_TOKENS.map((t) => "et-note-bg-" + t),
  ]);

  function scrub(node) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) continue;

      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        continue;
      }

      if (!ALLOWED.has(child.tagName)) {
        // Unwrap rather than delete: someone's words should not vanish just
        // because they were wrapped in a tag we do not keep.
        scrub(child);
        child.replaceWith(...child.childNodes);
        continue;
      }

      const keep = ATTRS[child.tagName] || [];
      for (const attr of [...child.attributes]) {
        if (!keep.includes(attr.name)) {
          child.removeAttribute(attr.name);
          continue;
        }
        if (attr.name === "href" && !/^https?:\/\/|^mailto:/i.test(attr.value))
          child.removeAttribute("href");
        if (attr.name === "class") {
          const kept = attr.value
            .split(/\s+/)
            .filter((c) => CLASSES.has(c))
            .join(" ");
          if (kept) child.setAttribute("class", kept);
          else child.removeAttribute("class");
        }
      }

      // Anything opening a new tab must not hand it a live `window.opener`.
      if (child.tagName === "A" && child.getAttribute("href")) {
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "noopener noreferrer");
      }

      scrub(child);
    }
  }

  /**
   * Spans that ended up carrying nothing are unwrapped.
   *
   * Colouring a run and then clearing it leaves the wrapper behind, and doing
   * that a few times nests wrappers inside wrappers. None of them affect what
   * is on screen, but they are stored, synced and re-parsed on every render,
   * so a note that has been edited for a while quietly grows a hull of dead
   * markup. Dropping them here means it is cleaned on the way in *and* on the
   * way out, whatever produced them.
   */
  function unwrapBareSpans(root) {
    for (const span of [...root.querySelectorAll("span")]) {
      if (!span.attributes.length) span.replaceWith(...span.childNodes);
    }
  }

  /** @returns {string} Sanitised HTML, safe to assign to innerHTML. */
  function clean(html) {
    const doc = new DOMParser().parseFromString(
      "<!doctype html><html><body>" + String(html || "") + "</body></html>",
      "text/html",
    );
    scrub(doc.body);
    unwrapBareSpans(doc.body);
    return doc.body.innerHTML;
  }

  /**
   * Notes written before the editor understood formatting are plain text, and
   * a line of prose containing "a < b" must not be mistaken for markup. The
   * test is deliberately narrow: a real tag, not merely an angle bracket.
   */
  const looksLikeHtml = (s) => /<\/?[a-z][\s\S]*>/i.test(String(s || ""));

  function fromPlainText(text) {
    const esc = String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return esc
      .split(/\r?\n/)
      .map((line) => `<div>${line || "<br>"}</div>`)
      .join("");
  }

  /** What a stored note should look like in the editor. */
  function toEditor(stored) {
    const raw = String(stored || "");
    if (!raw) return "";
    return looksLikeHtml(raw) ? clean(raw) : fromPlainText(raw);
  }

  /**
   * Flattens a note back to text, for export and the word count. Block
   * boundaries become newlines and checklist items keep their box, so an
   * exported .txt reads the way the note looked.
   */
  function toText(html) {
    const doc = new DOMParser().parseFromString(
      "<!doctype html><html><body>" + String(html || "") + "</body></html>",
      "text/html",
    );

    const walk = (node) => {
      let out = "";
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          out += child.nodeValue;
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;

        const tag = child.tagName;
        if (tag === "BR") {
          out += "\n";
          continue;
        }
        if (tag === "LI") {
          const box =
            child.getAttribute("data-checked") === "true"
              ? "[x] "
              : child.parentElement?.classList.contains("et-note-checklist")
                ? "[ ] "
                : "- ";
          out += box + walk(child).trim() + "\n";
          continue;
        }
        const block = /^(P|DIV|H1|H2|H3|UL|OL|BLOCKQUOTE|PRE)$/.test(tag);
        const inner = walk(child);
        out += block ? inner.replace(/\n*$/, "") + "\n" : inner;
      }
      return out;
    };

    return walk(doc.body).replace(/\n{3,}/g, "\n\n").trim();
  }

  /**
   * Unchecked checklist items in a note, in document order. Used by the Home
   * to-do widget, which needs the open items without caring about the rest of
   * the note's formatting.
   * @returns {string[]}
   */
  const CHECKLIST_ITEMS = "ul.et-note-checklist > li";

  function pendingChecklistItems(html) {
    const doc = new DOMParser().parseFromString(
      "<!doctype html><html><body>" + String(html || "") + "</body></html>",
      "text/html",
    );
    // The index is the item's position among *all* checklist items in the
    // note, not among the unfinished ones, so it still points at the right
    // line after something above it has been ticked.
    return [...doc.querySelectorAll(CHECKLIST_ITEMS)]
      .map((li, index) => ({
        index,
        text: li.textContent.replace(/\s+/g, " ").trim(),
        checked: li.getAttribute("data-checked") === "true",
      }))
      .filter((item) => !item.checked && item.text);
  }

  /**
   * Ticks or un-ticks one checklist item and gives back the note's HTML.
   *
   * Marks rather than removes: a tick is a state change the user can undo by
   * clicking again, where deleting the line would throw away what they wrote
   * with no way back.
   *
   * @returns {string|null} New HTML, or null if the index does not exist.
   */
  function setChecklistChecked(html, index, checked) {
    const doc = new DOMParser().parseFromString(
      "<!doctype html><html><body>" + String(html || "") + "</body></html>",
      "text/html",
    );
    const items = doc.querySelectorAll(CHECKLIST_ITEMS);
    const li = items[index];
    if (!li) return null;
    li.setAttribute("data-checked", checked ? "true" : "false");
    return doc.body.innerHTML;
  }

  /**
   * Deletes one checklist item and gives back the note's HTML. A checklist
   * left with no items goes as well, rather than as an empty list.
   *
   * @returns {string|null} New HTML, or null if the index does not exist.
   */
  function removeChecklistItem(html, index) {
    const doc = new DOMParser().parseFromString(
      "<!doctype html><html><body>" + String(html || "") + "</body></html>",
      "text/html",
    );
    const li = doc.querySelectorAll(CHECKLIST_ITEMS)[index];
    if (!li) return null;
    const list = li.parentElement;
    li.remove();
    if (list && !list.querySelector("li")) list.remove();
    return doc.body.innerHTML;
  }

  return {
    COLOR_TOKENS,
    clean,
    toEditor,
    toText,
    looksLikeHtml,
    pendingChecklistItems,
    setChecklistChecked,
    removeChecklistItem,
  };
})();
