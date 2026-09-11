"use strict";

const todayKey = () => new Date().toLocaleDateString("sv");

const ToastSystem = (() => {
  const MAX_TOASTS = 3;

  /* One glyph per outcome, drawn rather than typed: a tick, an "i" and a cross
     read at 16px where the equivalent characters in the UI font do not, and
     they stay the same shape whatever typeface the user has chosen. */
  const GLYPHS = {
    success: '<polyline points="20 6 9 17 4 12"/>',
    error: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    warning: '<path d="M12 8v5"/><path d="M12 17h.01"/>',
    info: '<path d="M12 16v-5"/><path d="M12 8h.01"/>',
    loading: '<path d="M21 12a9 9 0 1 1-6.2-8.5"/>',
  };

  const glyphFor = (type) => GLYPHS[type] || GLYPHS.info;

  function markup(type, title, detail, actionLabel) {
    return `
      <span class="toast-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
             stroke-linecap="round" stroke-linejoin="round">${glyphFor(type)}</svg>
      </span>
      <span class="toast-body">
        <span class="toast-text">${escapeHtml(title)}</span>
        ${detail ? `<span class="toast-detail">${escapeHtml(detail)}</span>` : ""}
        ${
          actionLabel
            ? `<span class="toast-actions">
                 <button class="toast-action-btn" type="button">${escapeHtml(actionLabel)}</button>
                 <button class="toast-dismiss-btn" type="button">Dismiss</button>
               </span>`
            : ""
        }
      </span>
      <button class="toast-close" type="button" aria-label="Dismiss">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
  }

  /**
   * @param {string} message Headline. Says what happened, in a few words.
   * @param {string} type    success | error | warning | info | loading.
   * @param {number} duration 0 keeps it up until it is dismissed.
   * @param {string} [detail] Optional second line: why, or what to do next.
   */
  function show(message, type = "info", duration = 3000, detail = "") {
    const container = $("toastContainer");
    if (!container) return;

    const existing = [...container.querySelectorAll(".toast-msg")].find(
      (t) => t.dataset.msg === message && !t.classList.contains("is-exiting"),
    );
    if (existing) {
      if (existing.__timer) clearTimeout(existing.__timer);
      if (duration > 0)
        existing.__timer = setTimeout(() => dismiss(existing), duration);
      return createController(existing);
    }

    enforceLimit(container);

    const toast = document.createElement("div");
    toast.className = `toast-msg ${type}`;
    toast.dataset.msg = message;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    setSafeHTML(toast, markup(type, message, detail));
    wire(toast, duration, 1500);
    container.appendChild(toast);

    return createController(toast);
  }

  /** Shared hover-pause, close-button and auto-dismiss wiring. */
  function wire(toast, duration, resumeDelay) {
    toast
      .querySelector(".toast-close")
      ?.addEventListener("click", () => dismiss(toast));

    if (duration <= 0) return;
    toast.__timer = setTimeout(() => dismiss(toast), duration);
    toast.addEventListener("mouseenter", () => {
      if (toast.__timer) clearTimeout(toast.__timer);
    });
    toast.addEventListener("mouseleave", () => {
      toast.__timer = setTimeout(() => dismiss(toast), resumeDelay);
    });
  }

  function createController(toast) {
    return {
      dismiss: () => dismiss(toast),
      update: (newMsg, newType = "success", newDuration = 3000, detail = "") => {
        if (!toast || !toast.parentNode) return;
        toast.className = `toast-msg ${newType}`;
        toast.dataset.msg = newMsg;
        setSafeHTML(toast, markup(newType, newMsg, detail));
        wire(toast, newDuration, 1500);
      },
    };
  }

  /**
   * A toast the user can act on - undoing a delete, retrying a failed save.
   * The action sits under the message rather than beside it, so a long label
   * and a long message stop competing for the same line.
   */
  function action(
    message,
    actionLabel,
    onAction,
    type = "info",
    duration = 6000,
    detail = "",
  ) {
    const container = $("toastContainer");
    if (!container) return;

    enforceLimit(container);

    const toast = document.createElement("div");
    toast.className = `toast-msg ${type} has-action`;
    toast.dataset.msg = message;
    toast.setAttribute("role", "status");
    setSafeHTML(toast, markup(type, message, detail, actionLabel));

    toast.querySelector(".toast-action-btn")?.addEventListener("click", () => {
      onAction();
      dismiss(toast);
    });
    toast
      .querySelector(".toast-dismiss-btn")
      ?.addEventListener("click", () => dismiss(toast));
    wire(toast, duration, 2000);
    container.appendChild(toast);

    return createController(toast);
  }

  function dismiss(toast) {
    if (!toast || toast.classList.contains("is-exiting")) return;
    toast.classList.add("is-exiting");
    if (toast.__timer) clearTimeout(toast.__timer);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 160);
  }

  function enforceLimit(container) {
    const toasts = [...container.querySelectorAll(".toast-msg")];
    while (toasts.length >= MAX_TOASTS) {
      const oldest = toasts.shift();
      if (oldest.__timer) clearTimeout(oldest.__timer);
      oldest.remove();
    }
  }

  return {
    show,
    action,
    dismiss,
    default: (msg, dur, detail) => show(msg, "info", dur, detail),
    success: (msg, dur, detail) => show(msg, "success", dur, detail),
    error: (msg, dur, detail) => show(msg, "error", dur, detail),
    warning: (msg, dur, detail) => show(msg, "warning", dur, detail),
    warn: (msg, dur, detail) => show(msg, "warning", dur, detail),
    info: (msg, dur, detail) => show(msg, "info", dur, detail),
    loading: (msg, detail) => show(msg, "loading", 0, detail),
  };
})();

const PomodoroMode = (() => {
  const overlay = $("pomodoroOverlay");
  const closeBtn = $("pomodoroCloseBtn");
  const flipClock = $("pomoFlipClock");
  const statusText = $("pomoStatusText");
  const sessionsCount = $("pomoSessionsCount");
  const resetBtn = $("pomoResetBtn");
  const minTop = $("pomoMinTop");
  const minBottom = $("pomoMinBottom");
  const secTop = $("pomoSecTop");
  const secBottom = $("pomoSecBottom");

  let workDuration = 25 * 60;
  let timeLeft = workDuration;
  let running = false;
  let intervalId = null;
  let endTimeoutId = null;
  let deadline = null;
  let displayMode = "ms";
  const WHEEL_ROW = 36;
  const wheelScrollBehavior = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
  let wheelHours = 0;
  let wheelMinutes = 25;
  // Where focus was before the overlay opened, so closing it puts the user back.
  let lastFocus = null;

  function closeWheelPicker(restoreFocus = false) {
    const picker = $("pomoWheelPicker");
    const button = $("pomoCustomBtn");
    if (!picker || picker.hidden) return;
    picker.hidden = true;
    button?.setAttribute("aria-expanded", "false");
    if (restoreFocus) button?.focus();
  }

  function syncWheel(wheel, value) {
    if (!wheel) return;
    const max = Number(wheel.dataset.max) || 0;
    const selected = Math.min(max, Math.max(0, Math.round(value)));
    if (wheel.id === "pomoHoursWheel") wheelHours = selected;
    else wheelMinutes = selected;
    wheel.querySelectorAll('[role="option"]').forEach((item, index) => {
      const active = index === selected;
      item.classList.toggle("is-selected", active);
      item.setAttribute("aria-selected", String(active));
    });
  }

  function buildWheel(wheel, max) {
    if (!wheel) return;
    wheel.dataset.max = String(max);
    const frag = document.createDocumentFragment();
    for (let value = 0; value <= max; value++) {
      const item = document.createElement("div");
      item.className = "et-pomo-wheel-item";
      item.setAttribute("role", "option");
      item.dataset.value = String(value);
      item.textContent = String(value).padStart(2, "0");
      item.addEventListener("click", () => {
        wheel.scrollTo({
          top: value * WHEEL_ROW,
          behavior: wheelScrollBehavior(),
        });
        syncWheel(wheel, value);
      });
      frag.appendChild(item);
    }
    wheel.replaceChildren(frag);

    let settleTimer = null;
    wheel.addEventListener(
      "scroll",
      () => {
        const value = Math.min(
          max,
          Math.max(0, Math.round(wheel.scrollTop / WHEEL_ROW)),
        );
        syncWheel(wheel, value);
        clearTimeout(settleTimer);
        settleTimer = setTimeout(
          () =>
            wheel.scrollTo({
              top: value * WHEEL_ROW,
              behavior: wheelScrollBehavior(),
            }),
          70,
        );
      },
      { passive: true },
    );
    wheel.addEventListener("keydown", (e) => {
      const current = Math.round(wheel.scrollTop / WHEEL_ROW);
      let next = current;
      if (e.key === "ArrowUp") next--;
      else if (e.key === "ArrowDown") next++;
      else if (e.key === "PageUp") next -= 5;
      else if (e.key === "PageDown") next += 5;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = max;
      else return;
      e.preventDefault();
      next = Math.min(max, Math.max(0, next));
      wheel.scrollTo({
        top: next * WHEEL_ROW,
        behavior: wheelScrollBehavior(),
      });
      syncWheel(wheel, next);
    });
  }

  function openWheelPicker() {
    const picker = $("pomoWheelPicker");
    const button = $("pomoCustomBtn");
    if (!picker) return;
    const total = Math.min(999, Math.max(1, Math.round(workDuration / 60)));
    wheelHours = Math.floor(total / 60);
    wheelMinutes = total % 60;
    picker.hidden = false;
    button?.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      const hours = $("pomoHoursWheel");
      const minutes = $("pomoMinutesWheel");
      hours.scrollTop = wheelHours * WHEEL_ROW;
      minutes.scrollTop = wheelMinutes * WHEEL_ROW;
      syncWheel(hours, wheelHours);
      syncWheel(minutes, wheelMinutes);
      hours.focus({ preventScroll: true });
    });
  }

  function setDuration(minutes, source) {
    const mins = Math.min(999, Math.max(1, Math.round(Number(minutes) || 25)));
    $$("#pomoPresetRow .et-pomo-preset-btn").forEach((b) => {
      b.classList.toggle(
        "active",
        source === "preset" && Number(b.dataset.mins) === mins,
      );
    });
    const customButton = $("pomoCustomBtn");
    if (customButton)
      customButton.textContent = source === "preset" ? "Custom" : `${mins}m`;
    closeWheelPicker();
    workDuration = mins * 60;
    timeLeft = workDuration;
    reset();
  }

  function setDisplayMode(mode, save = true) {
    displayMode = mode === "hm" ? "hm" : "ms";
    $$(".et-pomo-display-switch button").forEach((button) => {
      const active = button.dataset.mode === displayMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    overlay?.classList.toggle("is-hours-minutes", displayMode === "hm");
    updateDisplay();
    if (save) persistState();
  }

  function init() {
    if (!overlay) return;
    closeBtn?.addEventListener("click", exit);
    flipClock?.addEventListener("click", toggle);
    resetBtn?.addEventListener("click", reset);

    // A chip clicked with the pointer keeps DOM focus afterwards, and the
    // overlay's key handler deliberately ignores keys aimed at a button - so
    // space did nothing after picking a duration until you clicked the page to
    // move focus off the chip. Releasing focus on pointer activation puts the
    // shortcut back immediately.
    //
    // `detail > 0` is the pointer/click case. Keyboard activation reports 0,
    // and there focus must stay put: a keyboard user needs the chip to remain
    // focused, and space re-pressing a focused button is the correct behaviour.
    const releaseAfterPointer = (btn, e) => {
      if (e.detail > 0) btn.blur();
    };

    $$("#pomoPresetRow .et-pomo-preset-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        setDuration(parseInt(btn.dataset.mins, 10) || 25, "preset");
        releaseAfterPointer(btn, e);
      });
    });

    buildWheel($("pomoHoursWheel"), 16);
    buildWheel($("pomoMinutesWheel"), 59);
    $("pomoCustomBtn")?.addEventListener("click", openWheelPicker);
    $$(".et-pomo-display-switch button").forEach((button) => {
      button.addEventListener("click", (e) => {
        setDisplayMode(button.dataset.mode);
        releaseAfterPointer(button, e);
      });
    });
    $("pomoWheelCancel")?.addEventListener("click", () =>
      closeWheelPicker(true),
    );
    $("pomoWheelDone")?.addEventListener("click", () => {
      const total = Math.min(999, Math.max(1, wheelHours * 60 + wheelMinutes));
      setDuration(total, "custom");
      $("pomoCustomBtn")?.focus();
    });
    overlay.addEventListener("pointerdown", (e) => {
      const picker = $("pomoWheelPicker");
      if (
        picker &&
        !picker.hidden &&
        !picker.contains(e.target) &&
        !e.target.closest("#pomoCustomBtn")
      )
        closeWheelPicker();
    });

    // A drag-select that ends outside the panel must not dismiss it.
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && gestureStartedIn(overlay.firstElementChild))
        e.stopPropagation();
    });

    document.addEventListener("keydown", (e) => {
      if (!overlay.classList.contains("open")) return;
      if (!e.key) return;
      if (e.key === "Escape" && !$("pomoWheelPicker")?.hidden) {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeWheelPicker(true);
        return;
      }
      // Typing keeps its keys. A button keeps Space only when it was reached by
      // keyboard - then Space is how you press it. A button that was merely
      // clicked (a preset, the display switch) should not swallow the start key.
      if (e.target?.matches?.("input, select, textarea, [contenteditable]")) return;
      if (
        e.key === " " &&
        e.target?.matches?.("button") &&
        e.target.matches(":focus-visible")
      )
        return;
      if (e.target?.closest?.(".et-pomo-wheel-picker")) return;
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      }
      if (e.key.toLowerCase() === "r") reset();
    });

    restore();
    updateDisplay();
    updateSessions();
  }

  function persistState() {
    const d = StorageManager.getData();
    d.pomodoro = running
      ? {
          running: true,
          endsAt: deadline ?? Date.now() + timeLeft * 1000,
          workDuration,
          displayMode,
        }
      : { running: false, timeLeft, workDuration, displayMode };
    StorageManager.save();
  }

  function restore() {
    const p = StorageManager.getData().pomodoro;
    if (!p || typeof p !== "object") return;
    setDisplayMode(p.displayMode, false);
    if (typeof p.workDuration === "number" && p.workDuration > 0) {
      const mins = Math.min(999, Math.max(1, Math.round(p.workDuration / 60)));
      workDuration = mins * 60;
      const btn = document.querySelector(
        `#pomoPresetRow .et-pomo-preset-btn[data-mins="${mins}"]`,
      );
      $$("#pomoPresetRow .et-pomo-preset-btn").forEach((b) =>
        b.classList.toggle("active", b === btn),
      );
      const customButton = $("pomoCustomBtn");
      if (customButton) customButton.textContent = btn ? "Custom" : `${mins}m`;
    }
    if (p.running && p.endsAt) {
      const left = Math.round((p.endsAt - Date.now()) / 1000);
      if (left > 0) {
        timeLeft = left;
        start();
        return;
      }
      timeLeft = workDuration;
    } else if (typeof p.timeLeft === "number" && p.timeLeft > 0) {
      timeLeft = Math.min(workDuration, Math.max(1, Math.round(p.timeLeft)));
      if (statusText) statusText.textContent = "Paused";
    }
  }

  function updateRunningUI() {
    if (overlay) {
      overlay.classList.toggle("is-running", running);
    }
    // Stopping always brings the room back up; there is nothing to be calm
    // about once the countdown is not moving.
    if (!running) wake();
    else armZen();
  }

  // ------------------------------------------------------------- zen mode
  //
  // A focus timer that keeps a reset button, four preset chips and a close
  // cross in your eyeline is not a focus timer, it is a dashboard. So once the
  // countdown is running and the pointer has been still for a moment, every
  // control fades out and only the clock is left, breathing. Any movement or
  // keypress brings the controls straight back - nothing is unreachable, it is
  // just out of the way.
  //
  // The idle timer runs only while the overlay is open and counting, and it is
  // a single timeout rather than a poll, so an idle Zen screen costs nothing.

  const ZEN_IDLE_MS = 3000;
  let zenTimer = null;
  let zenWired = false;

  function armZen() {
    if (!overlay) return;
    clearTimeout(zenTimer);
    if (!running || !overlay.classList.contains("open")) return;
    zenTimer = setTimeout(() => {
      if (running && overlay.classList.contains("open"))
        overlay.classList.add("is-zen");
    }, ZEN_IDLE_MS);
  }

  function wake() {
    if (!overlay) return;
    clearTimeout(zenTimer);
    overlay.classList.remove("is-zen");
  }

  function wireZen() {
    if (zenWired || !overlay) return;
    zenWired = true;
    // `pointermove` fires at the pointer's sampling rate - well over a hundred
    // times a second on a fast mouse - and re-arming a timeout on every one of
    // those is a hundred timer churns a second to answer a question that only
    // changes every few seconds. So the idle countdown is re-armed at most
    // ten times a second; waking is still immediate, because that is the part
    // a person can feel.
    let lastRouse = 0;
    const rouse = () => {
      if (overlay.classList.contains("is-zen")) {
        wake();
        lastRouse = 0;
      }
      const now = performance.now();
      if (now - lastRouse < 100) return;
      lastRouse = now;
      armZen();
    };
    ["pointermove", "pointerdown", "keydown", "wheel"].forEach((evt) =>
      overlay.addEventListener(evt, rouse, { passive: true }),
    );
  }

  function enter() {
    if (!overlay) return;
    /* Focus moves into the timer. It used to stay on the toolbar button that
       opened it - and the Space handler below deliberately leaves Space alone
       when a button has focus, so the one key the screen tells you to press
       did nothing until you clicked somewhere on the page first. */
    if (!overlay.contains(document.activeElement))
      lastFocus = document.activeElement;
    overlay.classList.add("open");
    if (!overlay.hasAttribute("tabindex")) overlay.setAttribute("tabindex", "-1");
    overlay.focus({ preventScroll: true });
    wireZen();
    updateSessions();
    updateRunningUI();
  }
  function exit() {
    // Back to whatever opened the timer, once this call has finished closing it.
    queueMicrotask(() => {
      if (lastFocus && lastFocus.isConnected)
        lastFocus.focus({ preventScroll: true });
      lastFocus = null;
    });
    if (!overlay) return;
    closeWheelPicker();
    wake();
    overlay.classList.remove("open");
    pause();
  }
  function toggle() {
    if (running) pause();
    else start();
  }
  function start() {
    running = true;
    updateRunningUI();
    if (statusText) statusText.textContent = "Focusing";
    disarmTicker();
    // Anchored to the wall clock rather than counted in interval ticks. A
    // background tab has its timers throttled to once a minute or worse, so a
    // `timeLeft--` per tick makes a 25 minute session take far longer than 25
    // minutes - the countdown visibly crawls the moment the tab loses focus.
    deadline = Date.now() + timeLeft * 1000;
    armTicker();
    updateDisplay();
    persistState();
  }

  /**
   * Runs the countdown at display rate only while the tab is on screen.
   *
   * The remaining time is derived from `deadline`, so ticking in a hidden tab
   * repaints a display nobody can see four times a second. What a hidden tab
   * still owes the user is the *completion* - so instead of a fast interval it
   * holds a single timeout aimed at the deadline. Both paths land on `tick()`,
   * which is idempotent, so the two can never disagree about the time left.
   */
  function armTicker() {
    disarmTicker();
    if (!running || deadline == null) return;

    if (document.visibilityState === "visible") {
      intervalId = setInterval(tick, 250);
    } else {
      // A hidden tab's timeouts are throttled but still fire, and a late
      // completion is corrected the moment the tab is looked at again.
      endTimeoutId = setTimeout(tick, Math.max(0, deadline - Date.now()) + 50);
    }
  }

  function disarmTicker() {
    if (intervalId) clearInterval(intervalId);
    if (endTimeoutId) clearTimeout(endTimeoutId);
    intervalId = null;
    endTimeoutId = null;
  }

  // Catch the countdown up the instant the tab is on screen again rather than
  // waiting for the next throttled wake-up, and swap between the two tickers.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick();
    armTicker();
  });

  function tick() {
    if (!running || deadline == null) return;
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (left === timeLeft) return;
    timeLeft = left;
    updateDisplay();
    if (timeLeft <= 0) complete();
  }
  function pause() {
    const was = running;
    if (was && deadline != null) {
      timeLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      updateDisplay();
    }
    deadline = null;
    running = false;
    updateRunningUI();
    if (statusText) statusText.textContent = "Paused";
    disarmTicker();
    if (was) persistState();
  }
  function reset() {
    pause();
    timeLeft = workDuration;
    if (statusText) statusText.textContent = "Press space to start";
    updateDisplay();
    updateRunningUI();
    persistState();

    updateSessions();
    WidgetsRenderer.initFocusStats();
  }
  function complete() {
    pause();
    const today = todayKey();
    const data = StorageManager.getData();
    if (!data.focus) data.focus = {};
    data.focus[today] = (data.focus[today] || 0) + 1;
    StorageManager.save();
    updateSessions();
    WidgetsRenderer.initFocusStats();
    playChime();
    if (statusText) statusText.textContent = "Session complete";
    timeLeft = workDuration;
    updateDisplay();
    updateRunningUI();
    persistState();
    // No toast: the timer already says "Session complete" and plays the chime,
    // and a second notice for the same moment was only noise.
  }
  function updateDisplay() {
    const firstValue =
      displayMode === "hm"
        ? Math.floor(timeLeft / 3600)
        : Math.floor(timeLeft / 60);
    const secondValue =
      displayMode === "hm" ? Math.floor((timeLeft % 3600) / 60) : timeLeft % 60;
    const first = String(firstValue).padStart(2, "0");
    const second = String(secondValue).padStart(2, "0");
    if (minTop) minTop.textContent = first;
    if (minBottom) minBottom.textContent = first;
    if (secTop) secTop.textContent = second;
    if (secBottom) secBottom.textContent = second;
    overlay?.classList.toggle(
      "has-wide-timer-value",
      first.length > 2 || second.length > 2,
    );
  }
  function updateSessions() {
    if (!sessionsCount) return;
    const today = todayKey();
    const data = StorageManager.getData();
    const count = (data.focus && data.focus[today]) || 0;
    // Shown from the second session on. A count of one - or none - says
    // nothing the timer in front of you does not.
    sessionsCount.hidden = count < 2;
    sessionsCount.textContent = count >= 2 ? `${count} sessions today` : "";
  }
  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } catch {}
  }
  return { init, enter, exit };
})();
