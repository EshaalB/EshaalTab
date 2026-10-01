"use strict";

const NoteHTML = (() => {
  const ALLOWED = new Set([
    "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL",
    "P", "DIV", "BR", "SPAN",
    "H1", "H2", "H3",
    "UL", "OL", "LI",
    "BLOCKQUOTE", "CODE", "PRE", "A",
  ]);

  const ATTRS = {
    A: ["href", "target", "rel"],
    LI: ["data-checked"],
    UL: ["class"],
    SPAN: ["class"],
  };

  const COLOR_TOKENS = [
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "grey",

    "none",
  ];

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

      if (child.tagName === "A" && child.getAttribute("href")) {
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "noopener noreferrer");
      }

      scrub(child);
    }
  }

  function unwrapBareSpans(root) {
    for (const span of [...root.querySelectorAll("span")]) {
      if (!span.attributes.length) span.replaceWith(...span.childNodes);
    }
  }

  function clean(html) {
    const doc = new DOMParser().parseFromString(
      "<!doctype html><html><body>" + String(html || "") + "</body></html>",
      "text/html",
    );
    scrub(doc.body);
    unwrapBareSpans(doc.body);
    return doc.body.innerHTML;
  }

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

  function toEditor(stored) {
    const raw = String(stored || "");
    if (!raw) return "";
    return looksLikeHtml(raw) ? clean(raw) : fromPlainText(raw);
  }

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

  const CHECKLIST_ITEMS = "ul.et-note-checklist > li";

  function pendingChecklistItems(html) {
    const doc = new DOMParser().parseFromString(
      "<!doctype html><html><body>" + String(html || "") + "</body></html>",
      "text/html",
    );

    return [...doc.querySelectorAll(CHECKLIST_ITEMS)]
      .map((li, index) => ({
        index,
        text: li.textContent.replace(/\s+/g, " ").trim(),
        checked: li.getAttribute("data-checked") === "true",
      }))
      .filter((item) => !item.checked && item.text);
  }

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
    removeChecklistItem,
  };
})();
