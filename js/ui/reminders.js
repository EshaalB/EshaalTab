"use strict";

/**
 * Shared reminder infrastructure: time parsing, a self-correcting scheduler,
 * cross-tab fire de-duplication, and delivery (toast + chime + toolbar badge).
 *
 * Used by TodoWidget (task reminders) and BreakTimer (break nudges) so there is
 * exactly one timer loop and one de-dup store for the whole page.
 */
const ReminderKit = (() => {
  // How long after a missed reminder we still bother announcing it. Opening a
  // tab at 11pm should not replay every reminder from that morning, but a tab
  // opened a little late should still catch up.
  const CATCHUP_MS = 6 * 60 * 60 * 1000;
  // Upper bound on sleep, so new/edited todos and clock changes are noticed
  // even when the next due time is far away.
  const MAX_SLEEP_MS = 60 * 1000;
  const FIRED_KEY = "et_reminder_fired";

  // ---------------------------------------------------------------- parsing

  // "3pm", "3 p.m.", "3:05 PM"
  const RE_MERIDIEM = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i;
  // "14:30", "2:20"
  const RE_CLOCK = /\b(\d{1,2}):(\d{2})\b/;

  /**
   * Extracts a time-of-day from free text.
   * @returns {{h:number,min:number,explicit:boolean}|null} `explicit` is false
   *   when the text alone cannot tell 2am from 2pm.
   */
  function parseTime(text) {
    const s = String(text || "");

    const m = s.match(RE_MERIDIEM);
    if (m) {
      let h = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      const pm = m[3].toLowerCase() === "p";
      if (h < 1 || h > 12 || min > 59) return null;
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
      return { h, min, explicit: true };
    }

    const c = s.match(RE_CLOCK);
    if (c) {
      const h = parseInt(c[1], 10);
      const min = parseInt(c[2], 10);
      if (h > 23 || min > 59) return null;
      // 0 and 13-23 can only mean one thing; 1-12 are ambiguous.
      return { h, min, explicit: h === 0 || h > 12 };
    }

    return null;
  }

  /**
   * Turns an ambiguous hour into a concrete one by asking which reading comes
   * next in real time. Typing "2:20" at 1pm means 14:20, not 02:20 tomorrow.
   */
  function resolveHour(parsed, nowTs = Date.now()) {
    if (!parsed) return null;
    if (parsed.explicit) return parsed.h;

    const base = parsed.h % 12; // 12 -> 0
    const candidates = [base, base + 12];
    const now = new Date(nowTs);

    let best = null;
    for (const h of candidates) {
      const at = new Date(now);
      at.setHours(h, parsed.min, 0, 0);
      if (at.getTime() > nowTs && (best === null || at.getTime() < best.ts))
        best = { h, ts: at.getTime() };
    }
    // Both readings already passed today — the earlier one comes first tomorrow.
    return best ? best.h : Math.min(...candidates);
  }

  /**
   * Fallback for reminders created before hours were resolved at entry time.
   * Treats a bare 1:00-6:59 as afternoon, which is what people almost always
   * mean; 7:00-12:59 is left as morning.
   */
  function assumeDaytimeHour(parsed) {
    if (!parsed) return null;
    if (parsed.explicit) return parsed.h;
    return parsed.h >= 1 && parsed.h <= 6 ? parsed.h + 12 : parsed.h;
  }

  /** Timestamp for h:min on the same calendar day as `ref`. */
  function timeOn(ref, h, min) {
    const d = new Date(ref);
    d.setHours(h, min, 0, 0);
    return d.getTime();
  }

  function formatTime(h, min) {
    const use12 = StorageManager.getSettings().use12h;
    if (!use12)
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    const suffix = h >= 12 ? "pm" : "am";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(min).padStart(2, "0")}${suffix}`;
  }

  // ------------------------------------------------- cross-tab de-duplication

  const hasExtStore = () => {
    try {
      return !!(
        typeof HAS_EXT !== "undefined" &&
        HAS_EXT &&
        EXT.storage &&
        EXT.storage.local
      );
    } catch {
      return false;
    }
  };

  async function readFired() {
    try {
      if (hasExtStore()) {
        const bag = await EXT.storage.local.get(FIRED_KEY);
        return bag[FIRED_KEY] && typeof bag[FIRED_KEY] === "object"
          ? bag[FIRED_KEY]
          : {};
      }
      return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
    } catch {
      return {};
    }
  }

  async function writeFired(map) {
    try {
      if (hasExtStore()) await EXT.storage.local.set({ [FIRED_KEY]: map });
      else localStorage.setItem(FIRED_KEY, JSON.stringify(map));
    } catch {}
  }

  /**
   * Attempts to claim the right to fire `key`. Only one tab wins, so a user
   * with six new tabs open hears one chime rather than six.
   *
   * chrome.storage has no compare-and-swap, so this writes a claim stamped with
   * this page's writer id and then re-reads: whoever's stamp survived owns it.
   */
  async function claim(key) {
    const mine = StorageManager.getWriterId();
    const map = await readFired();
    if (map[key]) return false;

    // Drop anything older than a day so the map cannot grow without bound.
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const pruned = {};
    for (const [k, v] of Object.entries(map)) {
      if (v && typeof v === "object" && v.at > cutoff) pruned[k] = v;
    }
    pruned[key] = { by: mine, at: Date.now() };
    await writeFired(pruned);

    const confirmed = await readFired();
    return confirmed[key] && confirmed[key].by === mine;
  }

  /** Marks a key as handled without announcing it (used for stale catch-ups). */
  async function claimSilently(key) {
    await claim(key);
  }

  // -------------------------------------------------------------- delivery

  let audioCtx = null;

  function ctx() {
    if (!audioCtx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    return audioCtx;
  }

  // Autoplay policy keeps an AudioContext suspended until the page has seen a
  // gesture, and a context created outside one cannot be resumed later. So the
  // context is built and resumed on the first interaction, long before any
  // reminder needs it.
  function unlockAudio() {
    const c = ctx();
    if (c && c.state === "suspended") c.resume().catch(() => {});
  }

  /**
   * Plays the reminder tone.
   *
   * Scheduling is deliberately deferred until the context is actually running.
   * `resume()` is asynchronous, and a suspended context reports
   * `currentTime === 0` — booking notes against that clock means that by the
   * time audio starts the envelope has already elapsed, which is why the chime
   * came out clipped or silent.
   *
   * @returns {Promise<boolean>} Whether the tone was scheduled. A false here is
   *   the caller's cue that sound alone did not deliver the reminder.
   */
  async function chime(pattern = [800, 600]) {
    const c = ctx();
    if (!c) return false;

    if (c.state === "suspended") {
      try {
        await c.resume();
      } catch {
        return false;
      }
    }
    if (c.state !== "running") return false;

    try {
      // A small lead keeps the first note off the very edge of the clock,
      // where a busy main thread can swallow its attack.
      const start = c.currentTime + 0.05;
      pattern.forEach((freq, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        const t = start + i * 0.25;
        // Ramp up rather than jumping to full gain: a square-edged start on a
        // sine reads as a click before the tone.
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.start(t);
        osc.stop(t + 0.65);
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Flashes the toolbar icon. Uses the `action` API already available to the
   * service worker, so this needs no extra permission and is visible even when
   * the user is looking at a different tab.
   */
  function flashBadge(text = "!") {
    try {
      if (!hasExtStore() || !EXT.runtime?.sendMessage) return;
      const p = EXT.runtime.sendMessage({ type: "et-reminder-badge", text });
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {}
  }

  // The service worker fires the same reminders so they reach the user on
  // whatever tab they are actually looking at. It needs to know when not to:
  // while this page is on screen it delivers the nudge itself, with sound and
  // an overlay, and a system notification on top of that is just noise.
  const PAGE_VISIBLE_KEY = "et_page_visible_at";
  const HEARTBEAT_MS = 20 * 1000;

  function beat() {
    if (document.visibilityState !== "visible") return;
    try {
      if (hasExtStore()) EXT.storage.local.set({ [PAGE_VISIBLE_KEY]: Date.now() });
    } catch {}
  }

  function startVisibilityHeartbeat() {
    if (!hasExtStore()) return;
    beat();
    setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    window.addEventListener("focus", beat);
  }

  // ------------------------------------------------------------- scheduler

  const sources = [];
  let timer = null;
  let running = false;

  /**
   * Registers a reminder source.
   * @param {() => Array<{key:string,due:number,fire:Function,onMissed?:Function}>} collect
   *   Returns everything currently pending, with absolute due timestamps.
   */
  function register(collect) {
    sources.push(collect);
    if (running) tick();
  }

  async function tick() {
    clearTimeout(timer);
    const now = Date.now();
    let nextDue = Infinity;

    for (const collect of sources) {
      let pending = [];
      try {
        pending = collect() || [];
      } catch {
        continue;
      }

      for (const item of pending) {
        if (!item || !item.key || !Number.isFinite(item.due)) continue;

        if (now >= item.due) {
          // Fire on "now is past due", never on "now equals due" — a throttled
          // background tab can skip the target minute entirely, and that is
          // what used to make reminders vanish.
          const stale = now - item.due > CATCHUP_MS;
          if (stale) {
            await claimSilently(item.key);
            item.onMissed && item.onMissed();
          } else if (await claim(item.key)) {
            try {
              item.fire();
            } catch {}
          }
        } else if (item.due < nextDue) {
          nextDue = item.due;
        }
      }
    }

    const sleep = Math.max(
      250,
      Math.min(MAX_SLEEP_MS, nextDue === Infinity ? MAX_SLEEP_MS : nextDue - Date.now()),
    );
    timer = setTimeout(tick, sleep);
  }

  function start() {
    if (running) return;
    running = true;

    // Not `{ once: true }`: the first gesture can still fail to resume the
    // context (a background tab, a policy that wants a "real" click), and a
    // one-shot listener would leave the page permanently mute. The handler
    // detaches itself once the context is genuinely running.
    const gestures = ["pointerdown", "keydown", "touchstart"];
    const tryUnlock = () => {
      unlockAudio();
      if (audioCtx && audioCtx.state === "running")
        gestures.forEach((evt) => window.removeEventListener(evt, tryUnlock));
    };
    gestures.forEach((evt) =>
      window.addEventListener(evt, tryUnlock, { passive: true }),
    );

    startVisibilityHeartbeat();

    // Timers in hidden tabs get throttled hard, so re-check the moment the page
    // becomes visible again instead of waiting for the next tick.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") tick();
    });
    window.addEventListener("focus", () => tick());

    tick();
  }

  return {
    parseTime,
    resolveHour,
    assumeDaytimeHour,
    timeOn,
    formatTime,
    register,
    start,
    chime,
    flashBadge,
    claim,
    CATCHUP_MS,
  };
})();

/**
 * Break nudges: a periodic "step away from the screen" reminder.
 *
 * Rides entirely on ReminderKit — no timer of its own, no polling, no extra
 * storage keys — so the cost of the feature when it is switched off is a
 * single disabled check per scheduler tick.
 */
const BreakTimer = (() => {
  const MIN = 60 * 1000;

  const cfg = () => StorageManager.getSettings().breaks || {};
  const state = () => StorageManager.getData().breakState;

  const intervalMs = () => Math.max(1, cfg().everyMin || 45) * MIN;

  /** Pushes the next nudge one full interval out from now. */
  function reschedule(fromTs = Date.now()) {
    state().nextAt = fromTs + intervalMs();
    StorageManager.save();
  }

  /**
   * Returns when the next break is due, arming the clock on first use and
   * re-arming it whenever the stored time has drifted implausibly far — a
   * machine that was asleep for a week should not fire a backlog of nudges.
   */
  function nextAt() {
    const s = state();
    const now = Date.now();
    if (!s.nextAt || s.nextAt > now + intervalMs() + MIN) {
      reschedule(now);
    }
    return s.nextAt;
  }

  const SNOOZE_MIN = 5;

  /**
   * Shows the break nudge as a modal over the page.
   *
   * A toast was the wrong shape for this: it expires on its own, so the one
   * reminder you actually needed is the one that timed out while you were
   * heads-down. This waits to be dismissed. When the new tab page is not on
   * screen the service worker sends a system notification instead, so the
   * nudge lands wherever the user actually is.
   */
  function showOverlay(msg) {
    const overlay = $("breakOverlay");
    if (!overlay) {
      ToastSystem.info(msg);
      return;
    }

    const body = $("breakOverlayMsg");
    if (body) body.textContent = msg;

    const returnFocusTo = document.activeElement;
    const closeOverlay = () => {
      overlay.hidden = true;
      document.removeEventListener("keydown", onKey, true);
      try {
        returnFocusTo?.focus?.();
      } catch {}
    };

    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // Swallowed so the global Escape ladder does not also act on it.
      e.stopPropagation();
      e.preventDefault();
      closeOverlay();
    };

    const done = $("breakDoneBtn");
    const snooze = $("breakSnoozeBtn");
    // Cloned to drop listeners from a previous nudge rather than stacking them.
    const freshDone = done.cloneNode(true);
    const freshSnooze = snooze.cloneNode(true);
    done.replaceWith(freshDone);
    snooze.replaceWith(freshSnooze);

    freshDone.addEventListener("click", closeOverlay);
    freshSnooze.addEventListener("click", () => {
      state().nextAt = Date.now() + SNOOZE_MIN * MIN;
      StorageManager.save();
      closeOverlay();
      ToastSystem.info(`Break reminder snoozed for ${SNOOZE_MIN} minutes`);
    });

    document.addEventListener("keydown", onKey, true);
    overlay.hidden = false;
    freshDone.focus();
  }

  function fire() {
    const c = cfg();
    const msg = c.message || StorageManager.DEFAULT_SETTINGS.breaks.message;

    ReminderKit.flashBadge("☕");
    showOverlay(msg);
    // Fired after the overlay is up: the sound is the alert's companion, not
    // the alert itself, so a browser that refuses to play it changes nothing
    // about whether the reminder was delivered.
    if (c.sound !== false) ReminderKit.chime([660, 520, 660]);

    reschedule();
  }

  function collect() {
    if (!cfg().enabled) return [];
    const due = nextAt();
    return [
      {
        // Keyed by the exact due time, so all open tabs agree on which nudge
        // this is and only one of them announces it.
        key: `break_${due}`,
        due,
        fire,
        // A nudge that was missed by hours is not worth announcing late; just
        // start the next interval from now.
        onMissed: () => reschedule(),
      },
    ];
  }

  /** Called when the interval or on/off state changes in settings. */
  function restart() {
    if (cfg().enabled) reschedule();
    else {
      state().nextAt = 0;
      StorageManager.save();
    }
  }

  function init() {
    ReminderKit.register(collect);
  }

  return { init, restart, nextAt };
})();
