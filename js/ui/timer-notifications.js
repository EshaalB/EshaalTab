"use strict";

const todayKey = () => new Date().toLocaleDateString("sv");

const ToastSystem = (() => {
  const MAX_TOASTS = 3;

  function show(message, type = "info", duration = 3000) {
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

    setSafeHTML(
      toast,
      `<span class="toast-text">${escapeHtml(message)}</span>`,
    );

    container.appendChild(toast);

    if (duration > 0) {
      toast.__timer = setTimeout(() => dismiss(toast), duration);
      toast.addEventListener("mouseenter", () => {
        if (toast.__timer) clearTimeout(toast.__timer);
      });
      toast.addEventListener("mouseleave", () => {
        toast.__timer = setTimeout(() => dismiss(toast), 1500);
      });
    }

    return createController(toast);
  }

  function createController(toast) {
    return {
      dismiss: () => dismiss(toast),
      update: (newMsg, newType = "success", newDuration = 3000) => {
        if (!toast || !toast.parentNode) return;
        toast.className = `toast-msg ${newType}`;
        toast.dataset.msg = newMsg;
        const textEl = toast.querySelector(".toast-text");
        if (textEl) textEl.textContent = newMsg;
        if (toast.__timer) clearTimeout(toast.__timer);
        if (newDuration > 0) {
          toast.__timer = setTimeout(() => dismiss(toast), newDuration);
        }
      },
    };
  }

  function action(
    message,
    actionLabel,
    onAction,
    type = "info",
    duration = 6000,
  ) {
    const container = $("toastContainer");
    if (!container) return;

    enforceLimit(container);

    const toast = document.createElement("div");
    toast.className = `toast-msg ${type} has-action`;
    toast.dataset.msg = message;

    setSafeHTML(
      toast,
      `
      <span class="toast-text">${escapeHtml(message)}</span>
      <button class="toast-action-btn">${escapeHtml(actionLabel)}</button>
    `,
    );

    container.appendChild(toast);

    if (duration > 0) {
      toast.__timer = setTimeout(() => dismiss(toast), duration);
    }

    const btn = toast.querySelector(".toast-action-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        onAction();
        dismiss(toast);
      });
    }

    toast.addEventListener("mouseenter", () => {
      if (toast.__timer) clearTimeout(toast.__timer);
    });

    toast.addEventListener("mouseleave", () => {
      toast.__timer = setTimeout(() => dismiss(toast), 2000);
    });

    return createController(toast);
  }

  function dismiss(toast) {
    if (!toast || toast.classList.contains("is-exiting")) return;
    toast.classList.add("is-exiting");
    if (toast.__timer) clearTimeout(toast.__timer);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 100);
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
    default: (msg, dur) => show(msg, "default", dur),
    success: (msg, dur) => show(msg, "success", dur),
    error: (msg, dur) => show(msg, "error", dur),
    warning: (msg, dur) => show(msg, "warning", dur),
    warn: (msg, dur) => show(msg, "warning", dur),
    info: (msg, dur) => show(msg, "info", dur),
    loading: (msg) => show(msg, "loading", 0),
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
  let displayMode = "ms";
  const WHEEL_ROW = 36;
  const wheelScrollBehavior = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
  let wheelHours = 0;
  let wheelMinutes = 25;

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
    $$("#pomoPresetRow .et-pomo-display-switch button").forEach((button) => {
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

    $$("#pomoPresetRow .et-pomo-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setDuration(parseInt(btn.dataset.mins, 10) || 25, "preset");
      });
    });

    buildWheel($("pomoHoursWheel"), 16);
    buildWheel($("pomoMinutesWheel"), 59);
    $("pomoCustomBtn")?.addEventListener("click", openWheelPicker);
    $$("#pomoPresetRow .et-pomo-display-switch button").forEach((button) => {
      button.addEventListener("click", () =>
        setDisplayMode(button.dataset.mode),
      );
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
      if (e.target?.matches?.("input, select, button")) return;
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
          endsAt: Date.now() + timeLeft * 1000,
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
  }

  function enter() {
    if (!overlay) return;
    overlay.classList.add("open");
    updateSessions();
    updateRunningUI();
  }
  function exit() {
    if (!overlay) return;
    closeWheelPicker();
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
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
      timeLeft--;
      updateDisplay();
      if (timeLeft <= 0) complete();
    }, 1000);
    updateDisplay();
    persistState();
  }
  function pause() {
    const was = running;
    running = false;
    updateRunningUI();
    if (statusText) statusText.textContent = "Paused";
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
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
    ToastSystem.success("Session complete");
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
    sessionsCount.textContent = count
      ? `${count} session${count === 1 ? "" : "s"} today`
      : "No sessions yet today";
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
