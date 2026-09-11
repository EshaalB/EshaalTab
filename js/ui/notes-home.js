"use strict";

const NotesRenderer = (() => {
  let bound = false;
  let tabsBound = false;

  // True once the user has actually edited the textarea in this page. Until
  // then the textarea's value is not authoritative and must never be written
  // back over stored notes (see the sync guard in js/main.js).
  let dirty = false;

  let sessionStart = null;

  let historyIndex = -1;
  let draftBeforeHistory = null;

  function commitSessionToHistory() {
    if (sessionStart === null) return;
    const area = $("notesArea");
    if (area && sessionStart !== readEditor())
      NotesManager.pushHistory(sessionStart);
    sessionStart = null;
  }

  function flushPending() {
    const area = $("notesArea");
    if (!area || !bound || !dirty) return;
    const html = readEditor();
    if (html !== NotesManager.get()) NotesManager.set(html);
    commitSessionToHistory();
  }

  // The textarea only holds real content once it has been rendered *and*
  // edited. Anything else is an empty placeholder that must not be persisted.
  function hasLiveEdits() {
    return bound && dirty;
  }

  // Rate-limited: `input` fires per keystroke, and once someone is sitting at
  // the cap every further character would otherwise raise its own toast.
  let truncWarnedAt = 0;
  function warnTruncated() {
    if (Date.now() - truncWarnedAt < 10000) return;
    truncWarnedAt = Date.now();
    ToastSystem.info(
      `Note is full at ${NotesManager.MAX_CHARS.toLocaleString()} characters. The rest was not saved.`,
    );
  }

  // Counts the words a reader would see, not the markup around them.
  function updateStats(stored) {
    const badge = $("notesStatsBadge");
    if (!badge) return;
    const text = NoteHTML.toText(NoteHTML.toEditor(stored)).trim();
    const words = text ? text.split(/\s+/).length : 0;
    badge.textContent = `${words} word${words === 1 ? "" : "s"}`;
  }

  function markSaved(saved) {
    $("notesSaveBtn")?.classList.toggle("is-saved", saved);
  }

  // ------------------------------------------------------------- font size

  const FONT_MIN = 11;
  const FONT_MAX = 28;

  function fontSize() {
    const n = StorageManager.getSettings().notesFontSize;
    return Number.isFinite(n) ? Math.min(FONT_MAX, Math.max(FONT_MIN, n)) : 15;
  }

  function applyFontSize() {
    const px = fontSize();
    const area = $("notesArea");
    if (area) area.style.setProperty("--notes-font-size", `${px}px`);
    const val = $("notesFontVal");
    if (val) val.textContent = String(px);
  }

  function nudgeFont(delta) {
    const current = fontSize();
    const next = Math.min(FONT_MAX, Math.max(FONT_MIN, current + delta));
    if (next === current) return;
    StorageManager.getSettings().notesFontSize = next;
    StorageManager.saveSettings();
    applyFontSize();
  }

  // -------------------------------------------------------- editing helpers

  /** The editor's content, sanitised, as it should be stored. */
  function readEditor() {
    const area = $("notesArea");
    return area ? NoteHTML.clean(area.innerHTML) : "";
  }

  /** Paints stored content into the editor, converting legacy plain text. */
  function writeEditor(stored) {
    const area = $("notesArea");
    if (!area) return;
    setSafeHTML(area, NoteHTML.toEditor(stored));
    refreshEmpty();
  }

  // contenteditable has no `:placeholder-shown`, and an "empty" editor is
  // rarely an empty string - browsers leave a stray <br> or <div> behind. So
  // emptiness is decided by the text, and CSS keys off the class.
  function refreshEmpty() {
    const area = $("notesArea");
    if (!area) return;
    const blank = !area.textContent.trim() && !area.querySelector("li");
    area.classList.toggle("is-empty", blank);
  }

  /**
   * Records an edit: word count, save badge, and the store. Called from the
   * `input` event, so it covers typing, formatting commands, paste and the
   * browser's own undo alike.
   */
  function commitEdit() {
    const area = $("notesArea");
    if (!area) return;
    dirty = true;
    historyIndex = -1;
    refreshEmpty();

    const html = readEditor();
    updateStats(html);
    markSaved(false);
    NotesManager.set(html);

    if (NotesManager.lastWriteTruncated()) {
      writeEditor(NotesManager.get());
      updateStats(NotesManager.get());
      warnTruncated();
    }
  }

  /** True when the caret sits at the very first position in the editor. */
  function caretAtStart() {
    const area = $("notesArea");
    const sel = window.getSelection();
    if (!area || !sel || !sel.isCollapsed || !sel.rangeCount) return false;
    const probe = document.createRange();
    probe.selectNodeContents(area);
    probe.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
    return probe.toString().length === 0;
  }

  function placeCaret(atEnd) {
    const area = $("notesArea");
    if (!area) return;
    const range = document.createRange();
    range.selectNodeContents(area);
    range.collapse(!atEnd);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /**
   * Runs a formatting command against the selection.
   *
   * `document.execCommand` is formally deprecated and still the only API that
   * applies rich formatting to a contenteditable selection while keeping the
   * browser's native undo stack intact. Every shipping browser implements it;
   * the replacement everyone points to does not exist yet. Reimplementing bold
   * over arbitrary DOM ranges is exactly the wrong place to be clever, so it
   * is used deliberately and kept in this one function.
   */
  function exec(command, value = null) {
    const area = $("notesArea");
    if (!area) return;
    area.focus();
    try {
      document.execCommand(command, false, value);
    } catch {}
    commitEdit();
  }

  /* ------------------------------------------------------------ note colour

     Colour and highlight are applied with `execCommand` and then immediately
     rewritten into class names.

     Doing it in two steps looks redundant and is not. Applying a colour to a
     selection means splitting the text nodes at both ends, walking every
     element the range crosses, merging with any run that already carries the
     same formatting, and leaving the caret where the user left it. That is
     precisely what `execCommand` is good at and precisely the thing not to
     hand-write over arbitrary DOM ranges - the same reasoning `exec` above
     already spells out for bold.

     What `execCommand` produces is an inline `style`, which is the one thing
     notes must not store (see `notes-html.js`). So it is handed a fixed
     sentinel colour per token, and the moment the command returns, every
     element wearing that sentinel is converted to the matching class and the
     inline style is dropped. The sentinels are constants rather than the real
     palette values so the mapping cannot be confused by a colour that merely
     happens to look similar, and so it stays correct in either theme.

     The conversion pass also cleans: any inline colour it does *not*
     recognise - from a paste, or a note written before the sanitiser - is
     stripped rather than left to be removed later. That is what stops a
     stray colour appearing to be the note's own default. */
  const COLOR_TOKENS = ["red", "orange", "yellow", "green", "blue", "purple", "grey"];

  const SENTINELS = {
    red: "rgb(254, 0, 1)",
    orange: "rgb(254, 106, 1)",
    yellow: "rgb(254, 200, 1)",
    green: "rgb(1, 176, 74)",
    blue: "rgb(1, 105, 254)",
    purple: "rgb(138, 1, 254)",
    grey: "rgb(110, 118, 129)",
    none: "rgb(1, 2, 3)",
  };

  const sentinelHex = (token) => {
    const [r, g, b] = SENTINELS[token].match(/\d+/g).map(Number);
    return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
  };

  /** Which token, if any, a computed colour string names. */
  function tokenForColor(value) {
    if (!value) return null;
    const v = String(value).trim().replace(/\s+/g, " ");
    for (const [token, rgb] of Object.entries(SENTINELS)) {
      if (v === rgb) return token;
    }
    return null;
  }

  const groupClass = (group, token) => `et-note-${group}-${token}`;

  /** Strips every class this group owns, leaving other formatting alone. */
  function clearGroupClasses(el, group) {
    if (!el.classList.length) return;
    [...el.classList]
      .filter((c) => c.startsWith(`et-note-${group}-`))
      .forEach((c) => el.classList.remove(c));
    if (!el.classList.length) el.removeAttribute("class");
  }

  /**
   * Rewrites the inline colours `execCommand` just wrote into class names, and
   * drops any it does not recognise.
   *
   * @param {"fg"|"bg"} group Which of the two properties was being set.
   */
  function absorbInlineColors(group) {
    const area = $("notesArea");
    if (!area) return;
    const prop = group === "fg" ? "color" : "backgroundColor";

    for (const el of [...area.querySelectorAll("[style], font, [color]")]) {
      const inline = el.style ? el.style[prop] : "";
      const legacy = group === "fg" ? el.getAttribute("color") : null;
      const token = tokenForColor(inline) || tokenForColor(legacy);

      if (token) {
        clearGroupClasses(el, group);
        el.classList.add(groupClass(group, token));
      }

      // Whatever it was, the inline declaration does not survive: either it
      // has just become a class, or it is a colour from outside this palette
      // that the note has no business carrying.
      if (el.style) {
        el.style.removeProperty("color");
        el.style.removeProperty("background-color");
        if (!el.getAttribute("style")) el.removeAttribute("style");
      }
      el.removeAttribute("color");

      // `<font>` is not in the sanitiser's allowlist, so it would be unwrapped
      // on the next save and take the class with it. Promoted now, while the
      // class is still attached to the run it belongs to.
      if (el.tagName === "FONT") {
        const span = document.createElement("span");
        if (el.getAttribute("class")) span.className = el.getAttribute("class");
        span.append(...el.childNodes);
        el.replaceWith(span.className ? span : document.createRange().createContextualFragment(span.innerHTML));
      }
    }
  }

  /**
   * Applies a colour token to the selection, or clears it when `token` is
   * "none".
   *
   * @param {"fg"|"bg"} group
   * @param {string} token One of COLOR_TOKENS, or "none".
   */
  function applyNoteColor(group, token) {
    const area = $("notesArea");
    if (!area) return;

    area.focus();
    restoreSavedRange();

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) {
      ToastSystem.info("Select some text first.");
      return;
    }

    /* `styleWithCSS` is a document-wide sticky flag, not a per-command option.

       It is turned on so `foreColor` emits a span carrying an inline colour -
       which `absorbInlineColors` can read - instead of a `<font>` element. But
       leaving it on changes what *every* later command produces: bold stopped
       being `<b>` and became `<span style="font-weight: bold">`, and since the
       sanitiser strips `style` from spans, bolding text and reloading silently
       lost the bold. It is put back the moment the colour command returns. */
    const value = sentinelHex(token);
    try {
      document.execCommand("styleWithCSS", false, true);
      if (group === "fg") {
        document.execCommand("foreColor", false, value);
      } else if (!document.execCommand("hiliteColor", false, value)) {
        // Firefox has historically only answered to `backColor` here.
        document.execCommand("backColor", false, value);
      }
    } catch {
    } finally {
      try {
        document.execCommand("styleWithCSS", false, false);
      } catch {}
    }

    absorbInlineColors(group);
    tidyRedundantNone(group);
    commitEdit();
    updateSwatches();
  }

  /**
   * Drops "no colour" markers that are not overriding anything.
   *
   * `none` only has to exist where it sits inside a coloured run, because that
   * is the only case where simply removing the class would let the enclosing
   * colour show through again. Everywhere else it is a span that says the text
   * is the colour it was already going to be - invisible, but stored, synced
   * and re-parsed forever after. Clearing a colour you had just applied is the
   * common case, and it should leave the note exactly as it started.
   *
   * The class is removed rather than the element: a span with no attributes
   * left is unwrapped by the sanitiser on the way to storage.
   */
  function tidyRedundantNone(group) {
    const area = $("notesArea");
    if (!area) return;
    const noneClass = groupClass(group, "none");
    const prefix = `et-note-${group}-`;

    for (const el of [...area.querySelectorAll("." + noneClass)]) {
      let parent = el.parentElement;
      let overriding = false;
      while (parent && parent !== area) {
        if (
          [...parent.classList].some(
            (c) => c.startsWith(prefix) && c !== noneClass,
          )
        ) {
          overriding = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!overriding) clearGroupClasses(el, group);
    }
  }

  /**
   * Drops both colour groups from every element the selection touches.
   *
   * `removeFormat` is the browser's own "make this plain again", and it has no
   * idea these classes exist - so clearing formatting used to strip the bold
   * and italic and leave the text still bright red. Whole elements are cleared
   * rather than the exact range: a class always spans a whole run, and a run
   * the selection reaches into is a run the user is asking to reset. Spans
   * left holding nothing are unwrapped by the sanitiser on the way out.
   */
  function clearColorClassesInSelection() {
    const area = $("notesArea");
    const sel = window.getSelection();
    if (!area || !sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    for (const el of [
      ...area.querySelectorAll('[class*="et-note-fg-"], [class*="et-note-bg-"]'),
    ]) {
      if (!range.intersectsNode(el)) continue;
      clearGroupClasses(el, "fg");
      clearGroupClasses(el, "bg");
    }
  }

  /** The token in force at the caret, for the toolbar swatch bars. */
  function activeColorToken(group) {
    const area = $("notesArea");
    const sel = window.getSelection();
    if (!area || !sel || !sel.rangeCount) return null;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node && node !== area) {
      const hit = [...node.classList].find((c) =>
        c.startsWith(`et-note-${group}-`),
      );
      if (hit) {
        const token = hit.slice(`et-note-${group}-`.length);
        return token === "none" ? null : token;
      }
      node = node.parentElement;
    }
    return null;
  }

  /** Paints the current colour onto the two toolbar buttons. */
  function updateSwatches() {
    const fg = activeColorToken("fg");
    const bg = activeColorToken("bg");
    const fgBar = $("notesTextColorBar");
    const bgBar = $("notesHighlightBar");
    if (fgBar)
      fgBar.style.setProperty(
        "--swatch",
        fg ? `var(--note-fg-${fg})` : "var(--text)",
      );
    if (bgBar)
      bgBar.style.setProperty(
        "--swatch",
        bg ? `var(--note-bg-${bg})` : "transparent",
      );
  }

  /* The selection has to survive the picker.

     Clicking a swatch moves focus out of the editor, and a contenteditable
     drops its selection when it loses focus. `mousedown` is prevented on the
     picker for the same reason it is on the toolbar, but that alone is not
     enough on every engine, so the range is also captured when the picker
     opens and put back before the command runs. */
  let savedRange = null;

  function saveRange() {
    const sel = window.getSelection();
    savedRange =
      sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  }

  function restoreSavedRange() {
    if (!savedRange) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  function closeColorMenu(returnFocus = false) {
    const menu = $("notesColorMenu");
    if (!menu || menu.hidden) return;
    const group = menu.dataset.group;
    menu.hidden = true;
    ["notesTextColorBtn", "notesHighlightBtn"].forEach((id) =>
      $(id)?.setAttribute("aria-expanded", "false"),
    );
    // Only when the menu was dismissed from the keyboard. Sending focus back
    // after a click would drag it away from wherever the pointer went next.
    if (returnFocus) {
      $(group === "bg" ? "notesHighlightBtn" : "notesTextColorBtn")?.focus();
    }
  }

  /**
   * Arrow-key movement inside the picker.
   *
   * The swatches are laid out in a four-column grid, so Up and Down move by a
   * row rather than doing nothing - matching what the eye expects from the
   * shape on screen. Movement wraps, and lands on a real swatch at both ends.
   */
  function bindColorMenuKeys() {
    const menu = $("notesColorMenu");
    if (!menu) return;
    const COLS = 4;

    menu.addEventListener("keydown", (e) => {
      const items = [...menu.querySelectorAll(".et-note-color-swatch")];
      if (!items.length) return;
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;

      const go = (next) => {
        e.preventDefault();
        const target = items[(next + items.length) % items.length];
        items.forEach((el) => el.setAttribute("tabindex", "-1"));
        target.setAttribute("tabindex", "0");
        target.focus();
      };

      switch (e.key) {
        case "ArrowRight":
          return go(i + 1);
        case "ArrowLeft":
          return go(i - 1);
        case "ArrowDown":
          return go(i + COLS < items.length ? i + COLS : i % COLS);
        case "ArrowUp":
          return go(i - COLS >= 0 ? i - COLS : i);
        case "Home":
          return go(0);
        case "End":
          return go(items.length - 1);
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          closeColorMenu(true);
          return;
        case "Tab":
          // A menu is one stop in the tab order; leaving it closes it.
          closeColorMenu(false);
          return;
      }
    });
  }

  function openColorMenu(group, viaKeyboard = false) {
    const menu = $("notesColorMenu");
    const btn = $(group === "fg" ? "notesTextColorBtn" : "notesHighlightBtn");
    if (!menu || !btn) return;

    if (!menu.hidden && menu.dataset.group === group) {
      closeColorMenu(viaKeyboard);
      return;
    }

    saveRange();
    menu.dataset.group = group;
    menu.replaceChildren();

    const active = activeColorToken(group);
    const swatches = [...COLOR_TOKENS, "none"];

    for (const token of swatches) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "et-note-color-swatch";
      b.setAttribute("role", "menuitem");
      if (token === "none") {
        b.classList.add("is-none");
        b.title = group === "fg" ? "Default colour" : "No highlight";
        b.setAttribute("aria-label", b.title);
      } else {
        b.style.setProperty("--swatch", `var(--note-${group}-${token})`);
        b.title = token[0].toUpperCase() + token.slice(1);
        b.setAttribute("aria-label", b.title);
        if (token === active) b.classList.add("is-active");
      }
      b.addEventListener("click", () => {
        applyNoteColor(group, token);
        closeColorMenu();
      });
      menu.appendChild(b);
    }

    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");

    const r = btn.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - m.width - 8))}px`;
    menu.style.top =
      r.bottom + m.height + 8 < window.innerHeight
        ? `${r.bottom + 6}px`
        : `${Math.max(8, r.top - m.height - 6)}px`;

    /* `role="menu"` is a promise about keyboard behaviour, not just a label: a
       menu is one tab stop that you then move around inside with the arrow
       keys. Declaring the role and leaving eight separate tab stops - with
       focus still back in the editor - would be worse than not declaring it,
       because a screen reader announces a menu and then nothing behaves like
       one.

       Only for keyboard opens. A mouse user still has their caret and their
       selection where they left them, and pulling focus out of the editor
       under the pointer would take the selection highlight with it for no
       reason. `detail === 0` is how a button click raised by Enter or Space
       differs from one raised by a pointer.

       Focus lands on the swatch already in force, or the first one - and
       after positioning, so it cannot scroll anything toward a menu that is
       still at its previous coordinates. */
    if (!viaKeyboard) return;

    const swatchEls = [...menu.querySelectorAll(".et-note-color-swatch")];
    const startAt = Math.max(
      0,
      swatchEls.findIndex((el) => el.classList.contains("is-active")),
    );
    swatchEls.forEach((el, i) =>
      el.setAttribute("tabindex", i === startAt ? "0" : "-1"),
    );
    swatchEls[startAt]?.focus({ preventScroll: true });
  }

  /** The block element the caret is currently inside. */
  function currentBlock() {
    const area = $("notesArea");
    const sel = window.getSelection();
    if (!area || !sel || !sel.rangeCount) return null;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node && node !== area && !/^(P|DIV|LI|H1|H2|H3)$/.test(node.tagName))
      node = node.parentElement;
    return node === area ? null : node;
  }

  /**
   * Checklists.
   *
   * There is no `execCommand` for these, so one is built on top of the plain
   * bullet list: the same `<ul><li>` structure, marked with a class, with the
   * box drawn by CSS from `data-checked`. That keeps it a real list - Enter
   * makes a new item, Backspace at the start unwraps it, and the browser
   * handles all of that - instead of a stack of divs pretending to be one.
   */
  function toggleChecklist() {
    const area = $("notesArea");
    if (!area) return;
    const block = currentBlock();
    const list = block?.closest("ul");

    if (list && list.classList.contains("et-note-checklist")) {
      // Already a checklist: turn it back into an ordinary list.
      list.classList.remove("et-note-checklist");
      list.querySelectorAll("li").forEach((li) =>
        li.removeAttribute("data-checked"),
      );
      commitEdit();
      return;
    }

    if (!list) exec("insertUnorderedList");
    const made = currentBlock()?.closest("ul");
    if (!made) return;
    made.classList.add("et-note-checklist");
    made.querySelectorAll("li").forEach((li) => {
      if (!li.hasAttribute("data-checked")) li.setAttribute("data-checked", "false");
    });
    commitEdit();
  }

  /** Ticks a checklist item when its box is clicked. */
  function bindChecklistClicks() {
    const area = $("notesArea");
    if (!area) return;
    area.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-checked]");
      if (!li) return;
      // Only the box itself toggles; the rest of the row is editable text.
      const box = li.getBoundingClientRect();
      if (e.clientX - box.left > 22) return;
      e.preventDefault();
      li.setAttribute(
        "data-checked",
        li.getAttribute("data-checked") === "true" ? "false" : "true",
      );
      commitEdit();
    });
  }

  /**
   * Toggles a heading. `formatBlock` sets one but will not clear it, so an
   * already-heading block is walked back to a plain paragraph.
   */
  function toggleHeading() {
    const block = currentBlock();
    exec("formatBlock", /^H[123]$/.test(block?.tagName || "") ? "<p>" : "<h3>");
  }

  // ----------------------------------------------------------- note actions

  /** Deletes a note, asking first when it holds anything worth losing. */
  function deleteNote(id) {
    const note = NotesManager.list().find((n) => n.id === id);
    if (!note) return;

    if (NotesManager.list().length < 2) {
      ToastSystem.info("The notepad always keeps at least one note.");
      return;
    }

    const doDelete = () => {
      const wasActive = id === NotesManager.getActiveId();
      if (wasActive) commitSessionToHistory();
      if (!NotesManager.remove(id)) return;
      const area = $("notesArea");
      if (wasActive && area) {
        writeEditor(NotesManager.get());
        updateStats(NotesManager.get());
        markSaved(true);
        sessionStart = null;
      }
      renderTabs();
      ToastSystem.info("Note deleted");
    };

    if (note.text.trim()) {
      showCustomModal(
        "Delete note?",
        `<p class="dialog-message">“${escapeHtml(note.title)}” has content. This cannot be undone.</p>`,
        () => {
          doDelete();
          return true;
        },
        "Delete",
      );
    } else {
      doDelete();
    }
  }

  /** Creates a note and moves the editor into it. */
  function createNote() {
    // Must commit *before* adding: `add` makes the new note active, so
    // committing afterwards would write the old note's text into it.
    commitCurrent();
    if (!NotesManager.add()) {
      ToastSystem.info(`Notepad holds ${NotesManager.MAX_TABS} notes.`);
      return;
    }
    const area = $("notesArea");
    if (area) {
      writeEditor("");
      updateStats("");
      markSaved(true);
      area.focus();
    }
    sessionStart = null;
    renderTabs();
  }

  // ---------------------------------------------------------------- toolbar

  /**
   * @param {string} cmd
   * @param {boolean} viaKeyboard Whether the control was activated from the
   *   keyboard. Only the colour pickers care - it decides whether focus is
   *   pulled into the menu that opens.
   */
  async function runCommand(cmd, viaKeyboard = false) {
    const area = $("notesArea");
    if (!area) return;

    switch (cmd) {
      case "bold":
        return exec("bold");
      case "italic":
        return exec("italic");
      case "underline":
        return exec("underline");
      case "heading":
        return toggleHeading();
      case "bullet":
        return exec("insertUnorderedList");
      case "numbered":
        return exec("insertOrderedList");
      case "checklist":
        return toggleChecklist();
      case "clearFormat":
        exec("removeFormat");
        // `removeFormat` does not know about the colour classes, so it would
        // strip bold and italic and leave a coloured run coloured.
        clearColorClassesInSelection();
        commitEdit();
        updateSwatches();
        return;
      case "textColor":
        return openColorMenu("fg", viaKeyboard);
      case "highlight":
        return openColorMenu("bg", viaKeyboard);
      case "selectAll": {
        // `area` is a contenteditable div, not a form control - it has no
        // `.select()` method, so this used to throw and silently select
        // nothing. A Range over the whole editor is the actual equivalent.
        area.focus();
        const range = document.createRange();
        range.selectNodeContents(area);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      case "fontUp":
        return nudgeFont(1);
      case "fontDown":
        return nudgeFont(-1);
    }

    area.focus();
    const sel = window.getSelection();
    const selection = sel && !sel.isCollapsed ? sel.toString() : "";

    if (cmd === "copy") {
      // Copying with nothing selected almost always means "copy this note".
      const text =
        selection || NoteHTML.toText(NoteHTML.toEditor(readEditor()));
      if (!text.trim()) return;
      try {
        await navigator.clipboard.writeText(text);
        ToastSystem.success(selection ? "Copied" : "Note copied");
      } catch {
        ToastSystem.error("Clipboard access was blocked.");
      }
      return;
    }

    if (cmd === "cut") {
      if (!selection) {
        ToastSystem.info("Select some text to cut.");
        return;
      }
      try {
        await navigator.clipboard.writeText(selection);
      } catch {
        ToastSystem.error("Clipboard access was blocked.");
        return;
      }
      // `delete` rather than splicing strings: it removes exactly the selected
      // range across whatever elements it spans, and stays undoable.
      exec("delete");
      return;
    }

    if (cmd === "paste") {
      let text = "";
      try {
        text = await navigator.clipboard.readText();
      } catch {
        // Reading the clipboard needs a permission the user may have refused.
        // Ctrl+V never does, so point at it rather than failing silently.
        ToastSystem.info("Clipboard read was blocked. Press Ctrl+V instead.");
        return;
      }
      if (!text) return;
      exec("insertHTML", NoteHTML.toEditor(text));
    }
  }

  // Commands whose current on/off state can be read straight from the
  // selection, the same way Word or Google Docs presses a button in while the
  // caret sits inside bold text. `document.queryCommandState` covers the
  // native ones; heading and checklist have no such query, since neither is a
  // real execCommand, so they are read off the block the caret is in instead.
  const TOGGLE_COMMANDS = ["bold", "italic", "underline"];
  const LIST_COMMANDS = { bullet: "insertUnorderedList", numbered: "insertOrderedList" };

  /**
   * Reflects the caret's current formatting onto the toolbar, exactly once
   * per selection change - the thing a plain execCommand toolbar never did
   * here, so bold looked like a one-shot action instead of a state you could
   * see yourself sitting inside of.
   */
  function updateToolbarState() {
    const area = $("notesArea");
    const bar = $("notesToolbar");
    if (!area || !bar) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !area.contains(sel.anchorNode)) return;

    const setActive = (cmd, on) => {
      bar
        .querySelector(`[data-note-cmd="${cmd}"]`)
        ?.classList.toggle("is-active", !!on);
      bar
        .querySelector(`[data-note-cmd="${cmd}"]`)
        ?.setAttribute("aria-pressed", on ? "true" : "false");
    };

    TOGGLE_COMMANDS.forEach((cmd) => {
      let on = false;
      try {
        on = document.queryCommandState(cmd);
      } catch {}
      setActive(cmd, on);
    });
    const block = currentBlock();
    const isChecklist = !!block
      ?.closest("ul")
      ?.classList.contains("et-note-checklist");

    Object.entries(LIST_COMMANDS).forEach(([cmd, native]) => {
      let on = false;
      try {
        on = document.queryCommandState(native);
      } catch {}
      // A checklist is a <ul>, so the browser reports it as a bullet list too.
      // Lighting both up at once reads as two active modes when there is only
      // one, so the more specific of the two wins.
      if (cmd === "bullet" && isChecklist) on = false;
      setActive(cmd, on);
    });

    setActive("heading", /^H[123]$/.test(block?.tagName || ""));
    setActive("checklist", isChecklist);
  }

  /** Every toggle button off, for when the caret is not usefully anywhere. */
  function clearToolbarState() {
    $("notesToolbar")
      ?.querySelectorAll("[data-note-cmd].is-active")
      .forEach((btn) => {
        btn.classList.remove("is-active");
        btn.setAttribute("aria-pressed", "false");
      });
  }

  /** Opens or closes the toolbar's overflow menu. */
  function setMoreMenu(open) {
    const btn = $("notesMoreBtn");
    const menu = $("notesMoreMenu");
    if (!btn || !menu) return;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  }

  function bindToolbar() {
    const bar = $("notesToolbar");
    const area = $("notesArea");
    if (!bar) return;
    bar.addEventListener("click", (e) => {
      if (e.target.closest("#notesMoreBtn")) {
        e.preventDefault();
        setMoreMenu($("notesMoreMenu")?.hidden !== false);
        return;
      }
      const btn = e.target.closest("[data-note-cmd]");
      if (!btn) return;
      e.preventDefault();
      // `detail` is 0 for a click raised by Enter or Space on a focused
      // button, and 1+ for one raised by a pointer.
      runCommand(btn.dataset.noteCmd, e.detail === 0);
      updateToolbarState();
      updateSwatches();
    });

    // The picker steals focus the same way the toolbar buttons do, and for
    // the same reason must not be allowed to collapse the selection it is
    // about to colour. Pointer only - a keyboard user needs focus to actually
    // move into the menu, which is what `bindColorMenuKeys` then drives.
    $("notesColorMenu")?.addEventListener("mousedown", (e) =>
      e.preventDefault(),
    );
    bindColorMenuKeys();

    // Anywhere else closes it, including the Escape ladder.
    //
    // `closest` only exists on Elements: a pointerdown whose target is the
    // document or a text node threw here, and a listener that throws stops
    // running, so the menu could be left open with no way to dismiss it.
    document.addEventListener("pointerdown", (e) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el && el.closest("#notesMoreMenu, #notesMoreBtn")) return;
      setMoreMenu(false);
    });

    document.addEventListener(
      "pointerdown",
      (e) => {
        const el = e.target instanceof Element ? e.target : null;
        if (
          el &&
          el.closest("#notesColorMenu, #notesTextColorBtn, #notesHighlightBtn")
        )
          return;
        closeColorMenu();
      },
      { passive: true },
    );
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      // The colour picker sits above the overflow menu, so it comes off first.
      if ($("notesColorMenu")?.hidden === false) {
        e.stopPropagation();
        closeColorMenu(true);
        return;
      }
      if ($("notesMoreMenu")?.hidden === false) {
        e.stopPropagation();
        setMoreMenu(false);
      }
    });
    /* Fixed-position and anchored to a button, so it has to go when the thing
       it is anchored to moves.

       `capture` because the thing that scrolls is an inner element - the notes
       body or the toolbar - and a scroll event does not bubble to the window.
       `passive` because a capture-phase scroll listener sees *every* scroll in
       the document, and one that has not promised to skip `preventDefault`
       forces the browser to wait for it before each frame. This one only reads
       and hides a menu; saying so keeps scrolling off the main thread. */
    window.addEventListener("resize", closeColorMenu, { passive: true });
    window.addEventListener("scroll", closeColorMenu, {
      capture: true,
      passive: true,
    });

    // Buttons steal focus from the textarea on mousedown, which collapses the
    // very selection the command is about to act on.
    bar.addEventListener("mousedown", (e) => {
      if (e.target.closest("[data-note-cmd]")) e.preventDefault();
    });
    // Caret movement by keyboard or mouse, not just typing, changes what
    // "currently active" means - arrowing out of bold text should turn Bold
    // back off without needing an edit to trigger it.
    const syncToolbar = () => {
      updateToolbarState();
      updateSwatches();
    };
    area?.addEventListener("keyup", syncToolbar);
    area?.addEventListener("mouseup", syncToolbar);
    area?.addEventListener("focus", syncToolbar);
    document.addEventListener("selectionchange", () => {
      if (document.activeElement === area) updateToolbarState();
    });
  }

  // Commits whatever is in the textarea to the *current* note before the
  // active note changes underneath it, so switching tabs can't lose edits.
  function commitCurrent() {
    const area = $("notesArea");
    if (!area || !bound) return;
    const html = readEditor();
    if (html !== NotesManager.get()) NotesManager.setImmediate(html);
    commitSessionToHistory();
  }

  function switchTo(id) {
    if (id === NotesManager.getActiveId()) return;
    commitCurrent();
    NotesManager.setActive(id);
    const area = $("notesArea");
    if (area) {
      writeEditor(NotesManager.get());
      updateStats(NotesManager.get());
      markSaved(true);
      // The new note's caret is not sitting inside whatever the previous
      // note's toolbar last lit up, so that state has to go with it.
      clearToolbarState();
    }
    historyIndex = -1;
    sessionStart = null;
    renderTabs();
  }

  function renderTabs() {
    const strip = $("notesTabs");
    if (!strip) return;
    const notes = NotesManager.list();
    const activeId = NotesManager.getActiveId();
    const atLimit = notes.length >= NotesManager.MAX_TABS;

    setSafeHTML(
      strip,
      notes
        .map(
          (n) => `
        <button
          type="button"
          class="et-notes-tab ${n.id === activeId ? "is-active" : ""}"
          role="tab"
          aria-selected="${n.id === activeId}"
          data-id="${escapeHtml(n.id)}"
          title="${escapeHtml(n.title)} (double-click to rename)"
        >
          <span class="et-notes-tab-label">${escapeHtml(n.title)}</span>
          ${notes.length > 1 ? `<span class="et-notes-tab-close" role="button" aria-label="Delete ${escapeHtml(n.title)}">&times;</span>` : ""}
        </button>`,
        )
        .join("") +
        `<button type="button" class="et-notes-tab-add" id="notesTabAdd" ${atLimit ? "disabled" : ""} title="${atLimit ? `Limit is ${NotesManager.MAX_TABS} notes` : "New note"}">+</button>`,
    );

    if (!tabsBound) {
      tabsBound = true;

      strip.addEventListener("click", (e) => {
        if (e.target.closest("#notesTabAdd")) {
          createNote();
          return;
        }

        const tab = e.target.closest(".et-notes-tab");
        if (!tab) return;
        const id = tab.dataset.id;

        if (e.target.closest(".et-notes-tab-close")) {
          e.stopPropagation();
          // Committing first means the confirmation prompt cannot strand the
          // edits that are still only in the textarea.
          if (id === NotesManager.getActiveId()) commitCurrent();
          deleteNote(id);
          return;
        }

        switchTo(id);
      });

      strip.addEventListener("dblclick", (e) => {
        const tab = e.target.closest(".et-notes-tab");
        if (!tab) return;
        const id = tab.dataset.id;
        const note = NotesManager.list().find((n) => n.id === id);
        if (!note) return;
        showPrompt("Rename note", "Note name:", note.title, (val) => {
          if (val && val.trim() && NotesManager.rename(id, val)) renderTabs();
        });
      });
    }
  }

  function render() {
    const area = $("notesArea");
    if (!area) return;
    if (document.activeElement !== area) {
      writeEditor(NotesManager.get());
      updateStats(NotesManager.get());
      markSaved(true);
    }
    renderTabs();
    applyFontSize();
    ClipboardRenderer.render();
    if (!bound) {
      bound = true;
      bindToolbar();
      bindChecklistClicks();

      area.addEventListener("focus", () => {
        if (sessionStart === null) sessionStart = readEditor();
      });

      area.addEventListener("input", () => {
        commitEdit();
        updateToolbarState();
      });

      area.addEventListener("blur", () => {
        // Write through immediately rather than via the debounce, so the
        // "saved" badge is truthful and a fast tab-close cannot drop it.
        NotesManager.setImmediate(readEditor());
        markSaved(true);
        commitSessionToHistory();
      });

      // Paste arrives as whatever the source page was marked up as - fonts,
      // colours, tracking pixels. It is put through the same allowlist as
      // stored content, so the note keeps the words and the structure and
      // nothing else.
      area.addEventListener("paste", (e) => {
        const dt = e.clipboardData;
        if (!dt) return;
        e.preventDefault();
        const html = dt.getData("text/html");
        const text = dt.getData("text/plain");
        const safe = html
          ? NoteHTML.clean(html)
          : NoteHTML.toEditor(text || "");
        document.execCommand("insertHTML", false, safe);
        commitEdit();
      });

      area.addEventListener("keydown", (e) => {
        // The toolbar's formatting commands on the shortcuts people already
        // have in their fingers. Ctrl+A/C/X/V are the browser's own.
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
          const key = e.key.toLowerCase();
          if (key === "b" || key === "i" || key === "u") {
            e.preventDefault();
            runCommand(
              key === "b" ? "bold" : key === "i" ? "italic" : "underline",
            );
            return;
          }
        }

        if (e.key === "Tab") {
          // Inside a list, Tab is what nests an item - that is what everyone
          // expects there, and indenting with spaces instead would be wrong.
          e.preventDefault();
          const inList = !!currentBlock()?.closest("li");
          if (inList) exec(e.shiftKey ? "outdent" : "indent");
          else if (!e.shiftKey) exec("insertHTML", "&nbsp;&nbsp;");
          return;
        }

        if (e.key === "ArrowUp" && caretAtStart()) {
          const hist = NotesManager.getHistory();
          if (!hist.length) return;
          e.preventDefault();
          if (historyIndex === -1) draftBeforeHistory = readEditor();
          if (historyIndex < hist.length - 1) historyIndex++;
          writeEditor(hist[historyIndex]);
          placeCaret(false);
          dirty = true;
          updateStats(readEditor());
          markSaved(false);
        } else if (e.key === "ArrowDown" && historyIndex !== -1) {
          e.preventDefault();
          historyIndex--;
          writeEditor(
            historyIndex === -1
              ? (draftBeforeHistory ?? "")
              : NotesManager.getHistory()[historyIndex],
          );
          placeCaret(true);
          dirty = true;
          updateStats(readEditor());
          markSaved(false);
        }
      });

      $("notesSaveBtn")?.addEventListener("click", () => {
        NotesManager.setImmediate(readEditor());
        commitSessionToHistory();
        markSaved(true);
        ToastSystem.success("Notes saved");
      });

      // A note that was typed here stays authoritative for the life of the
      // page, so `dirty` is deliberately never reset - clearing it would
      // reopen the window where a remote sync overwrites local edits.

      $("notesExportBtn")?.addEventListener("click", () => {
        NotesManager.set(readEditor());
        NotesManager.exportTxt();
        ToastSystem.success("Notes exported");
      });
    }
  }
  return {
    render,
    flushPending,
    hasLiveEdits,
    switchTo,
    applyFontSize,
    readEditor,
  };
})();

const ClipboardRenderer = (() => {
  let bound = false;

  function render() {
    const listEl = $("clipList");
    const badgeEl = $("clipCountBadge");
    if (!listEl) return;

    const snippets = ClipboardManager.getAll();
    if (badgeEl) badgeEl.textContent = `${snippets.length} saved`;

    if (snippets.length === 0) {
      setSafeHTML(
        listEl,
        `
        <div class="et-clip-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          <span>No snippets saved yet. Paste a command or link above to save!</span>
        </div>`,
      );
    } else {
      setSafeHTML(
        listEl,
        snippets
          .map(
            (item) => `
        <div class="et-clip-item" data-id="${item.id}">
          <div class="et-clip-item-main" style="display:flex; flex-direction:column; gap:2px; flex:1; overflow:hidden;">
            ${item.title ? `<span class="et-clip-item-title" style="font-weight:600; color:var(--text); font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.title)}</span>` : ""}
            <span class="et-clip-item-text" style="font-size:12px; color:var(--text-dim); font-family:monospace; word-break:break-all;">${escapeHtml(item.text)}</span>
          </div>
          <div class="et-clip-item-actions">
            <button class="et-clip-copy-btn" data-no-tooltip aria-label="Copy snippet ${escapeHtml(item.title || item.label || item.text)}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="16" height="16" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy</span>
            </button>
            <button class="et-clip-del-btn" title="Delete snippet" aria-label="Delete snippet ${escapeHtml(item.title || item.label || item.text)}">&times;</button>
          </div>
        </div>
      `,
          )
          .join(""),
      );
    }

    if (!bound) {
      bound = true;
      const titleInp = $("clipTitleInput");
      const textInp = $("clipTextInput");
      const addBtn = $("clipAddBtn");

      function handleAdd() {
        if (!textInp) return;
        const text = textInp.value.trim();
        const title = titleInp ? titleInp.value.trim() : "";
        if (text) {
          ClipboardManager.add(text, title, title);
          StorageManager.saveImmediate();
          textInp.value = "";
          if (titleInp) titleInp.value = "";
          render();
          ToastSystem.success("Snippet added");
        }
      }

      addBtn?.addEventListener("click", handleAdd);
      textInp?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleAdd();
      });
      titleInp?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") textInp?.focus();
      });

      listEl.addEventListener("click", (e) => {
        const copyBtn = e.target.closest(".et-clip-copy-btn");
        if (copyBtn) {
          const itemEl = copyBtn.closest(".et-clip-item");
          const snippets = ClipboardManager.getAll();
          const found = snippets.find((s) => s.id === itemEl.dataset.id);
          if (found) {
            ClipboardManager.copy(found.text);
            copyBtn.classList.add("copied");
            const txt = copyBtn.querySelector("span");
            if (txt) txt.textContent = "Copied!";
            setTimeout(() => {
              copyBtn.classList.remove("copied");
              if (txt) txt.textContent = "Copy";
            }, 1500);
            ToastSystem.success("Copied to clipboard");
          }
          return;
        }

        const delBtn = e.target.closest(".et-clip-del-btn");
        if (delBtn) {
          const itemEl = delBtn.closest(".et-clip-item");
          ClipboardManager.remove(itemEl.dataset.id);
          render();
          ToastSystem.info("Snippet deleted");
        }
      });
    }
  }

  return { render };
})();

const HomeRenderer = (() => {
  // Three open tasks on Home by default, five if chosen in Settings - but never
  // more than three when the window is short enough that five would push the
  // centre column up into the toolbar.
  const TODO_LIMIT_SHORT = 3;
  const shortWindow = window.matchMedia("(max-height: 760px)");
  const visibleTodoLimit = () => {
    const chosen = StorageManager.getSettings().homeTaskCount === 5 ? 5 : 3;
    return shortWindow.matches ? Math.min(chosen, TODO_LIMIT_SHORT) : chosen;
  };
  const MAX_TODO_ORDER = 500;

  function init() {
    renderPinned();
    renderTodos();
    shortWindow.addEventListener?.("change", renderTodos);
    if (typeof PinnedBoards !== "undefined") PinnedBoards.init();
  }
  function render() {
    WidgetsRenderer.applyWidgetVisibility();
    renderPinned();
    renderTodos();
    if (typeof PinnedBoards !== "undefined") PinnedBoards.render();
  }

  /* A narrower window means a narrower column, which changes which lines
     overflow. Re-measuring is cheap - at most three rows - so it is done on
     resize rather than tracked with an observer per row. */
  let clipTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(clipTimer);
    clipTimer = setTimeout(() => {
      const wrap = $("homeTodos");
      if (wrap && wrap.childElementCount) markClippedTodos(wrap);
    }, 120);
  });

  const WEEKDAYS = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const MONTHS = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];

  /**
   * Reads a date out of a to-do's own words.
   *
   * Derived from the text every time it is rendered rather than stored: a
   * checklist item is a line of HTML with no id of its own, so there is
   * nowhere to keep a parsed date that would survive the line being edited.
   * Re-reading is also self-correcting - fix the wording and the date follows.
   *
   * @returns {{date: Date, label: string, matched: string}|null}
   */
  function parseDueDate(text) {
    const raw = String(text || "");
    const s = raw.toLowerCase();
    const now = new Date();
    const startOfDay = (d) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const shift = (days) => {
      const d = startOfDay(now);
      d.setDate(d.getDate() + days);
      return d;
    };

    let date = null;
    let matched = "";

    const rel = s.match(/\b(today|tonight|tomorrow|yesterday)\b/);
    if (rel) {
      matched = rel[1];
      date =
        rel[1] === "tomorrow"
          ? shift(1)
          : rel[1] === "yesterday"
            ? shift(-1)
            : shift(0);
    }

    // "friday", "next friday" - the coming one, or the week after for "next".
    if (!date) {
      const wd = s.match(
        new RegExp(`\\b(next\\s+)?(${WEEKDAYS.join("|")})\\b`),
      );
      if (wd) {
        matched = wd[0];
        const target = WEEKDAYS.indexOf(wd[2]);
        let delta = (target - now.getDay() + 7) % 7;
        if (delta === 0) delta = 7;
        if (wd[1]) delta += 7;
        date = shift(delta);
      }
    }

    // "12 sep" / "sep 12" / "september 12th"
    if (!date) {
      const md = s.match(
        new RegExp(
          `\\b(?:(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s+(${MONTHS.join("|")})|(${MONTHS.join("|")})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?)\\b`,
        ),
      );
      if (md) {
        matched = md[0];
        const day = Number(md[1] || md[4]);
        const mon = MONTHS.indexOf(md[2] || md[3]);
        if (day >= 1 && day <= 31 && mon >= 0) {
          let year = now.getFullYear();
          let candidate = new Date(year, mon, day);
          // A bare month and day that has already gone by almost always means
          // next year rather than a date in the past.
          if (candidate < startOfDay(now)) candidate = new Date(++year, mon, day);
          date = candidate;
        }
      }
    }

    if (!date || Number.isNaN(date.getTime())) return null;

    const days = Math.round((date - startOfDay(now)) / 86400000);
    let label;
    if (days === 0) label = "Today";
    else if (days === 1) label = "Tomorrow";
    else if (days === -1) label = "Yesterday";
    else if (days > 1 && days < 7)
      label = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
    else
      label = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date);

    return { date, label, matched, overdue: days < 0 };
  }

  const todoOrderKey = (noteId, text) =>
    `${noteId}::${String(text).trim().toLowerCase()}`;

  function savedTodoOrder() {
    const order = StorageManager.getData().todoOrder;
    return Array.isArray(order)
      ? order.filter((k) => typeof k === "string").slice(0, MAX_TODO_ORDER)
      : [];
  }

  function saveTodoOrder(keys) {
    StorageManager.getData().todoOrder = keys.slice(0, MAX_TODO_ORDER);
    StorageManager.save();
  }

  /**
   * Every open checklist item across all notes, in the order Home shows them.
   *
   * Items the user has placed in the Tasks dialog come first, in that order.
   * Everything else follows, most recently edited note first, so without an
   * order of its own Home still leads with what was being worked on last.
   *
   * An item is known by its note and its words rather than by its line number,
   * which moves whenever a line is added above it. Two identical lines in one
   * note are told apart by a counter.
   */
  function collectTodos() {
    const notes = [...NotesManager.list()].sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    );
    const items = [];
    const seen = new Map();
    for (const note of notes) {
      for (const entry of NoteHTML.pendingChecklistItems(note.text)) {
        const base = todoOrderKey(note.id, entry.text);
        const n = seen.get(base) || 0;
        seen.set(base, n + 1);
        items.push({
          noteId: note.id,
          noteTitle: note.title,
          text: entry.text,
          // Position within the note, so ticking from Home writes back to the
          // line the user actually clicked.
          index: entry.index,
          key: n ? `${base}#${n}` : base,
        });
      }
    }
    const rank = new Map(savedTodoOrder().map((k, i) => [k, i]));
    return items
      .map((item, i) => ({ item, i }))
      .sort((a, b) => {
        const ra = rank.has(a.item.key) ? rank.get(a.item.key) : Infinity;
        const rb = rank.has(b.item.key) ? rank.get(b.item.key) : Infinity;
        return ra === rb ? a.i - b.i : ra - rb;
      })
      .map((x) => x.item);
  }

  /** Moves one task to `toIndex` and saves the whole order. */
  function reorderTodos(key, toIndex) {
    const keys = collectTodos().map((t) => t.key);
    const from = keys.indexOf(key);
    if (from < 0) return false;
    keys.splice(from, 1);
    const to = Math.max(0, Math.min(keys.length, toIndex));
    if (to === from) return false;
    keys.splice(to, 0, key);
    saveTodoOrder(keys);
    renderTodos();
    return true;
  }

  /**
   * Lists the first few open tasks on Home, with a way to the rest.
   */
  function renderTodos() {
    const wrap = $("homeTodos");
    if (!wrap) return;

    // Switched off in Settings > Home page. Checked before any of the work of
    // scanning every note for checklist lines, not after.
    if (StorageManager.getSettings().widgets?.notesTodos === false) {
      wrap.style.display = "none";
      wrap.replaceChildren();
      return;
    }

    const all = collectTodos();
    if (!all.length) {
      wrap.style.display = "none";
      wrap.replaceChildren();
      return;
    }

    const items = all.slice(0, visibleTodoLimit());
    wrap.style.display = "flex";
    const frag = document.createDocumentFragment();

    // A heading, so the list is announced as "what is open today" rather than
    // appearing as unexplained lines under the clock.
    const label = document.createElement("div");
    label.className = "et-home-todos-label";
    label.textContent = "Today";
    frag.appendChild(label);

    // One column for the boxes. Each row used to be centred on its own width,
    // so a short task's box sat further right than a long one's and the ticks
    // zig-zagged down the page. The list is centred as a block instead, and
    // its rows share a left edge.
    const list = document.createElement("div");
    list.className = "et-home-todo-list";
    list.setAttribute("role", "list");

    items.forEach((item) => {
      const due = parseDueDate(item.text);

      // A row of two controls rather than one button wrapping everything: the
      // box completes the item and the text opens the note it lives in, and a
      // button cannot legally contain another button.
      const row = document.createElement("div");
      row.className = `et-home-todo${pendingTodoDeletes.has(item.key) ? " is-striking" : ""}`;
      row.setAttribute("role", "listitem");

      const box = document.createElement("button");
      box.type = "button";
      box.className = "et-home-todo-box";
      box.setAttribute("aria-label", `Done: delete "${item.text}"`);
      box.title = "Done";

      const open = document.createElement("button");
      open.type = "button";
      open.className = "et-home-todo-open";
      open.title = due
        ? `From "${item.noteTitle}" — read "${due.matched}" as ${due.label} (click to open)`
        : `From "${item.noteTitle}" (click to open)`;
      setSafeHTML(
        open,
        `
        <span class="et-home-todo-text">${escapeHtml(item.text)}</span>
        ${
          due
            ? `<span class="et-home-todo-due${due.overdue ? " is-overdue" : ""}">${escapeHtml(due.label)}</span>`
            : ""
        }
      `,
      );

      box.addEventListener("click", () => completeTodo(item, row));
      open.addEventListener("click", () => {
        ViewController.show("notes");
        NotesRenderer.switchTo(item.noteId);
      });

      row.append(box, open);
      list.appendChild(row);
    });
    frag.appendChild(list);

    // "+3 more" when tasks are left off; otherwise a quiet "Reorder" that
    // shows on hover or focus, so setting priorities is always possible
    // without adding a permanent control under a short list.
    if (all.length > 1) {
      const hidden = all.length - items.length;
      const more = document.createElement("button");
      more.type = "button";
      more.className = `et-home-todos-more${hidden ? "" : " is-quiet"}`;
      more.textContent = hidden ? `+${hidden} more` : "Reorder";
      more.setAttribute(
        "aria-label",
        hidden ? `Show all ${all.length} tasks` : "Reorder tasks",
      );
      more.addEventListener("click", openTodoModal);
      frag.appendChild(more);
    }

    wrap.replaceChildren(frag);
    markClippedTodos(wrap);
  }

  const GRIP_SVG =
    '<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="3" r="1.4"/><circle cx="7.5" cy="3" r="1.4"/><circle cx="2.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/><circle cx="2.5" cy="13" r="1.4"/><circle cx="7.5" cy="13" r="1.4"/></svg>';
  const chevronSvg = (up) =>
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="${up ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}"/></svg>`;

  /**
   * Every open task, and the order Home shows them in.
   *
   * Three ways to move one, so none of them is the only way: drag a row, use
   * its arrow buttons, or focus it and press Alt+Up / Alt+Down. Up and Down on
   * their own move between rows.
   */
  function openTodoModal() {
    showCustomModal(
      "Tasks",
      `
      <p class="et-todo-modal-hint">The first ${visibleTodoLimit()} show on Home. Drag a task, or focus it and press Alt+Up or Alt+Down, to change the order.</p>
      <div class="et-todo-modal-list" id="todoModalList" role="list" aria-label="Open tasks"></div>`,
      () => true,
      "Done",
    );
    // A list you edit in place has nothing to cancel.
    $("modalCancelBtn")?.remove();
    paintTodoModal();
    $("todoModalList")?.querySelector(".et-todo-m-row")?.focus();
  }

  function paintTodoModal(focusKey, focusSel = "") {
    const host = $("todoModalList");
    if (!host) return;
    const all = collectTodos();
    const limit = visibleTodoLimit();

    setSafeHTML(
      host,
      all.length
        ? all
            .map((it, i) => {
              const note = escapeHtml(it.noteTitle || "Untitled note");
              return `
        ${i === limit ? `<div class="et-todo-m-divider" role="presentation">Not on Home</div>` : ""}
        <div class="et-todo-m-row${pendingTodoDeletes.has(it.key) ? " is-striking" : ""}" role="listitem" tabindex="0" draggable="true" data-key="${escapeHtml(it.key)}" aria-label="${escapeHtml(it.text)}. ${i + 1} of ${all.length}.">
          <span class="et-todo-m-grip" aria-hidden="true">${GRIP_SVG}</span>
          <button type="button" class="et-home-todo-box et-todo-m-box" data-act="done" aria-label="Done: delete &quot;${escapeHtml(it.text)}&quot;" title="Done"></button>
          <span class="et-todo-m-text">${escapeHtml(it.text)}<span class="et-todo-m-note">${note}</span></span>
          <button type="button" class="et-todo-m-move" data-act="up" aria-label="Move up" title="Move up (Alt+Up)" ${i === 0 ? "disabled" : ""}>${chevronSvg(true)}</button>
          <button type="button" class="et-todo-m-move" data-act="down" aria-label="Move down" title="Move down (Alt+Down)" ${i === all.length - 1 ? "disabled" : ""}>${chevronSvg(false)}</button>
        </div>`;
            })
            .join("")
        : `<div class="et-todo-m-empty">Nothing left to do.</div>`,
    );

    if (focusKey) {
      const row = host.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
      let target = focusSel ? row?.querySelector(focusSel) : row;
      if (!target || target.disabled) target = row;
      target?.focus();
    }

    if (host.__bound) return;
    host.__bound = true;

    const indexOf = (key) => collectTodos().findIndex((t) => t.key === key);

    host.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      const row = btn?.closest(".et-todo-m-row");
      if (!row) return;
      const key = row.dataset.key;
      if (btn.dataset.act === "done") {
        const item = collectTodos().find((t) => t.key === key);
        if (item) completeTodo(item, row, () => paintTodoModal());
        return;
      }
      const step = btn.dataset.act === "up" ? -1 : 1;
      if (reorderTodos(key, indexOf(key) + step))
        paintTodoModal(key, `[data-act="${btn.dataset.act}"]`);
    });

    host.addEventListener("keydown", (e) => {
      const row = e.target.closest?.(".et-todo-m-row");
      if (!row || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      const up = e.key === "ArrowUp";
      if (e.altKey) {
        e.preventDefault();
        const key = row.dataset.key;
        const sel = e.target === row ? "" : `[data-act="${e.target.dataset.act}"]`;
        if (reorderTodos(key, indexOf(key) + (up ? -1 : 1))) paintTodoModal(key, sel);
      } else if (e.target === row) {
        e.preventDefault();
        const rows = [...host.querySelectorAll(".et-todo-m-row")];
        rows[rows.indexOf(row) + (up ? -1 : 1)]?.focus();
      }
    });

    let dragKey = null;
    const clearMarks = () =>
      host
        .querySelectorAll(".drop-before, .drop-after")
        .forEach((el) => el.classList.remove("drop-before", "drop-after"));

    host.addEventListener("dragstart", (e) => {
      const row = e.target.closest?.(".et-todo-m-row");
      if (!row) return;
      dragKey = row.dataset.key;
      row.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", dragKey);
      } catch {}
    });

    host.addEventListener("dragover", (e) => {
      if (!dragKey) return;
      e.preventDefault();
      const row = e.target.closest?.(".et-todo-m-row");
      clearMarks();
      if (!row || row.dataset.key === dragKey) return;
      const r = row.getBoundingClientRect();
      row.classList.add(e.clientY > r.top + r.height / 2 ? "drop-after" : "drop-before");
    });

    host.addEventListener("drop", (e) => {
      if (!dragKey) return;
      e.preventDefault();
      const key = dragKey;
      dragKey = null;
      const target = host.querySelector(".drop-before, .drop-after");
      clearMarks();
      if (!target) return;
      const rest = collectTodos()
        .map((t) => t.key)
        .filter((k) => k !== key);
      const to =
        rest.indexOf(target.dataset.key) +
        (target.classList.contains("drop-after") ? 1 : 0);
      if (reorderTodos(key, to)) paintTodoModal(key);
    });

    host.addEventListener("dragend", () => {
      dragKey = null;
      clearMarks();
      host
        .querySelectorAll(".is-dragging")
        .forEach((el) => el.classList.remove("is-dragging"));
    });
  }

  /**
   * Marks the task lines that are actually too long for their box.
   *
   * The edge fade is only honest when something has been cut off, and CSS has
   * no way to ask that question - so it is measured once per paint, after the
   * rows are in the document and have a width. `scrollWidth` exceeding
   * `clientWidth` by a pixel is rounding, not overflow, hence the small
   * tolerance.
   */
  function markClippedTodos(wrap) {
    for (const el of wrap.querySelectorAll(".et-home-todo-text")) {
      el.classList.toggle("is-clipped", el.scrollWidth - el.clientWidth > 1);
    }
  }

  // Tasks ticked and waiting to be deleted, by key: the timer that deletes
  // each, the toast offering to undo it, and the delete itself.
  const pendingTodoDeletes = new Map();
  const TODO_UNDO_MS = 3000;

  /** Removes a task's line from its note. Found by key, not by a stale index. */
  function deleteTodoLine(key) {
    const item = collectTodos().find((t) => t.key === key);
    if (!item) return false;
    const note = NotesManager.list().find((n) => n.id === item.noteId);
    if (!note) return false;
    const updated = NoteHTML.removeChecklistItem(note.text, item.index);
    if (updated == null) return false;
    note.text = updated;
    note.updatedAt = Date.now();
    const data = StorageManager.getData();
    // The editor renders from this mirror when the note is the open one.
    if (data.activeNoteId === note.id) data.notes = updated;
    StorageManager.saveImmediate();
    return true;
  }

  /**
   * Ticks a task off: struck through straight away, deleted from its note a
   * few seconds later unless the toast's Undo is pressed first.
   *
   * Deleted rather than marked done, because a finished task has nothing left
   * to do in the note either, and ticked lines were piling up there. The undo
   * window is what makes deleting safe. The line is looked up again by its key
   * when the time runs out rather than by the index it had when clicked: a
   * second tick in the same note meanwhile moves every line after it.
   */
  function completeTodo(item, row, after) {
    if (!item || pendingTodoDeletes.has(item.key)) return;
    row?.classList.add("is-striking");
    const label = item.text.length > 42 ? item.text.slice(0, 41).trimEnd() + "…" : item.text;

    const finish = () => {
      renderTodos();
      after?.();
    };
    const commit = () => {
      const pending = pendingTodoDeletes.get(item.key);
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingTodoDeletes.delete(item.key);
      pending.toast?.dismiss();
      deleteTodoLine(item.key);
      finish();
    };
    const undo = () => {
      const pending = pendingTodoDeletes.get(item.key);
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingTodoDeletes.delete(item.key);
      finish();
    };

    const timer = setTimeout(commit, TODO_UNDO_MS);
    const toast = ToastSystem.action(`Deleting "${label}"`, "Undo", undo, "info", TODO_UNDO_MS);
    pendingTodoDeletes.set(item.key, { timer, toast, commit });
  }

  // Closing the tab inside the undo window still deletes what was ticked.
  window.addEventListener("pagehide", () => {
    [...pendingTodoDeletes.values()].forEach((pending) => pending.commit());
  });

  function showAddPinModal() {
    const boards = BoardManager.getAll();
    if (!boards.length) {
      ToastSystem.info("Create a board first, then pin links to Home.");
      ViewController.show("boards");
      return;
    }

    showCustomModal(
      "Pin a link to Home",
      `
      <div class="dialog-stack">
        <div class="dialog-field">
          <label class="dialog-label" for="pinTitleInp">Title</label>
          <input type="text" id="pinTitleInp" class="dialog-input" placeholder="Title" />
        </div>
        <div class="dialog-field">
          <label class="dialog-label" for="pinUrlInp">URL</label>
          <input type="text" id="pinUrlInp" class="dialog-input" placeholder="Website URL" />
        </div>
      </div>`,
      () => {
        const titleEl = $("pinTitleInp");
        const urlEl = $("pinUrlInp");
        const title = titleEl.value.trim();
        const url = urlEl.value.trim();
        if (!url) {
          markInvalid(urlEl, true);
          showModalError("URL is required.");
          return false;
        }
        // Silently use the first board - no need to expose board selector
        const boardId = boards[0]?.id;
        const bm = BookmarkManager.add(boardId, title || url, url, []);
        if (!bm) {
          markInvalid(urlEl, true);
          showModalError("That does not look like a valid link.");
          return false;
        }
        if (BookmarkManager.togglePin(boardId, bm.id) === null) {
          ToastSystem.error(
            `Home holds ${BookmarkManager.PIN_LIMIT} pins. Unpin one first.`,
          );
        } else {
          ToastSystem.success("Pinned to Home");
        }
        StorageManager.saveImmediate();
        renderPinned();
        BoardRenderer.renderBoards();
        return true;
      },
      "Pin",
    );
  }

  function renderPinned() {
    const wrap = $("homePinned");
    if (!wrap) return;
    const settings = StorageManager.getSettings();
    if (settings.hidePinnedOnHome) {
      wrap.style.display = "none";
      return;
    }
    const pinned = BookmarkManager.getPinned();
    wrap.style.display = "flex";
    // Assembled off-DOM and swapped in once. Appending each pin to the live
    // dock re-laid the row out per tile and flashed an empty dock in between.
    const frag = document.createDocumentFragment();

    pinned.forEach((bm) => {
      const cell = document.createElement("div");
      cell.className = "dock-pin-wrap";
      cell.draggable = true;
      cell.dataset.id = bm.id;

      cell.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", bm.id);
        cell.style.opacity = "0.5";
      });
      cell.addEventListener("dragend", () => (cell.style.opacity = ""));
      cell.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (cell.style.transform !== "scale(1.05)")
          cell.style.transform = "scale(1.05)";
      });
      cell.addEventListener("dragleave", (e) => {
        // dragleave also fires as the pointer crosses into the tile's own
        // children, which made the hovered pin flicker between scales.
        if (e.relatedTarget && cell.contains(e.relatedTarget)) return;
        cell.style.transform = "";
      });
      cell.addEventListener("drop", (e) => {
        e.preventDefault();
        cell.style.transform = "";
        const draggedId = e.dataTransfer.getData("text/plain");
        if (draggedId && draggedId !== bm.id) {
          const arr = Array.from(wrap.children)
            .filter((c) => c.dataset.id)
            .map((c) => c.dataset.id);
          const fromIdx = arr.indexOf(draggedId);
          const toIdx = arr.indexOf(bm.id);
          if (fromIdx > -1 && toIdx > -1) {
            arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, draggedId);
            BookmarkManager.reorderPinned(arr);
            renderPinned();
          }
        }
      });

      /* Icon only. The name moved into a tooltip and the accessible name, so the
         row reads as a dock of icons rather than a grid of captioned tiles -
         and nothing is lost for a screen reader, which announces the link by
         its `aria-label` exactly as it announced the caption before. */
      const a = document.createElement("a");
      a.className = "dock-pin";
      a.href = safeHref(bm.url);
      a.setAttribute("data-id", bm.id);
      a.setAttribute("aria-label", bm.title);
      a.setAttribute("data-tooltip", bm.title);
      setSafeHTML(
        a,
        `
        <span class="dock-pin-icon">
          <img class="dock-pin-fav" ${faviconAttr(bm.url)} alt="" />
        </span>
      `,
      );
      wireFavicons(a);

      const menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.className = "dock-pin-menu-btn";
      menuBtn.setAttribute("aria-label", `Options for ${bm.title}`);
      menuBtn.setAttribute("data-tooltip", "Options");
      setSafeHTML(
        menuBtn,
        `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>`,
      );

      const showMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = menuBtn.getBoundingClientRect();
        if (typeof ContextMenu !== "undefined") {
          ContextMenu.show(
            e.clientX || r.left,
            e.clientY || r.bottom + 4,
            bm.boardId,
            bm,
          );
        }
      };

      a.addEventListener("contextmenu", showMenu);
      menuBtn.addEventListener("click", showMenu);
      // The keyboard's way to a context menu: the Menu key, or Shift+F10.
      a.addEventListener("keydown", (e) => {
        if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) showMenu(e);
      });

      cell.append(a, menuBtn);
      frag.appendChild(cell);
    });

    // Pinned boards open from the end of this row, beside the links they sit
    // with, rather than from a button of their own in a corner of the page.
    const appendBoardsButton = () => {
      if (typeof PinnedBoards === "undefined" || !PinnedBoards.enabled()) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "pinnedBoardsBtn";
      btn.className = "dock-pin dock-pin-boards";
      btn.dataset.popoverTrigger = "pinned-boards";
      btn.setAttribute("aria-label", "Pinned boards");
      btn.setAttribute("aria-haspopup", "dialog");
      btn.setAttribute("aria-controls", "pinnedBoardsPanel");
      btn.setAttribute("aria-expanded", String(PinnedBoards.isOpen()));
      btn.setAttribute("data-tooltip", "Pinned boards");
      setSafeHTML(
        btn,
        `<span class="dock-pin-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M8 7.5v8"/><path d="M12 7.5v4.5"/><path d="M16 7.5v6.5"/></svg></span>`,
      );
      btn.addEventListener("click", (e) => PinnedBoards.toggle(e.detail === 0));
      frag.appendChild(btn);
    };

    if (pinned.length >= BookmarkManager.PIN_LIMIT) {
      appendBoardsButton();
      wrap.replaceChildren(frag);
      return;
    }

    const add = document.createElement("button");
    add.type = "button";
    add.className = "dock-pin dock-pin-add";
    add.setAttribute("aria-label", "Add a link and pin it to Home");
    add.setAttribute("data-tooltip", pinned.length ? "Add pin" : "Pin a link");
    setSafeHTML(
      add,
      `
      <span class="dock-pin-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </span>
    `,
    );
    add.addEventListener("click", showAddPinModal);
    frag.appendChild(add);
    appendBoardsButton();
    wrap.replaceChildren(frag);
  }
  return { init, render, renderPinned, openTodoModal };
})();
