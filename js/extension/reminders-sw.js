"use strict";

// ---------------------------------------------------------------------------
// Reminders and break nudges, worker side.
//
// The page-side scheduler only exists while a new tab page is open, so on its
// own it can never reach someone who is reading something else — which is the
// only time a "take a break" nudge is worth anything. The worker keeps its own
// alarm so the notification arrives over whatever tab is in front.
//
// Loaded into the service worker by background.js, which owns `API` and
// `flashBadge`.
// ---------------------------------------------------------------------------

const REMINDER_ALARM = "et-reminders";
const FIRED_KEY = "et_reminder_fired";
// While a new tab page is visible it delivers the nudge itself, as an in-page
// overlay with sound. Two announcements of one reminder is worse than one, so
// the worker stays quiet for as long as the page keeps saying it is on screen.
const PAGE_VISIBLE_KEY = "et_page_visible_at";
const PAGE_VISIBLE_GRACE_MS = 45 * 1000;
const MIN = 60 * 1000;
const CATCHUP_MS = 6 * 60 * MIN;
const SNOOZE_MS = 5 * MIN;

const DEFAULT_BREAK_MESSAGE = "Time for a break - look away from the screen.";

// Time-of-day parsing, kept in step with ReminderKit.parseTime.
const RE_MERIDIEM = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i;
const RE_CLOCK = /\b(\d{1,2}):(\d{2})\b/;

function parseReminderTime(text) {
  const s = String(text || "");
  const m = s.match(RE_MERIDIEM);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const pm = m[3].toLowerCase() === "p";
    if (h < 1 || h > 12 || min > 59) return null;
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return { h, min };
  }
  const c = s.match(RE_CLOCK);
  if (c) {
    const h = parseInt(c[1], 10);
    const min = parseInt(c[2], 10);
    if (h > 23 || min > 59) return null;
    return { h, min };
  }
  return null;
}

function timeOn(ts, h, min) {
  const d = new Date(ts);
  d.setHours(h, min, 0, 0);
  return d.getTime();
}

function todayKey(ts) {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

async function readLocal(keys) {
  try {
    return (await API.storage.local.get(keys)) || {};
  } catch {
    return {};
  }
}

async function writeLocal(obj) {
  try {
    await API.storage.local.set(obj);
    return true;
  } catch {
    return false;
  }
}

const asObject = (v) => (v && typeof v === "object" ? v : {});

/**
 * Claims the right to announce `key`, so an open page and the worker cannot
 * both fire the same reminder. Same store and same record shape the page uses.
 */
async function claimFire(key) {
  const bag = await readLocal(FIRED_KEY);
  const map = asObject(bag[FIRED_KEY]);
  if (map[key]) return false;

  const cutoff = Date.now() - 24 * 60 * MIN;
  const pruned = {};
  for (const [k, v] of Object.entries(map)) {
    if (v && typeof v === "object" && v.at > cutoff) pruned[k] = v;
  }
  pruned[key] = { by: "sw", at: Date.now() };
  return writeLocal({ [FIRED_KEY]: pruned });
}

async function pageIsWatching() {
  const bag = await readLocal(PAGE_VISIBLE_KEY);
  return Date.now() - (Number(bag[PAGE_VISIBLE_KEY]) || 0) < PAGE_VISIBLE_GRACE_MS;
}

function notify(id, title, message, buttons) {
  return new Promise((resolve) => {
    try {
      API.notifications.create(
        id,
        {
          type: "basic",
          iconUrl: API.runtime.getURL("icons/icon128.png"),
          title,
          message,
          priority: 2,
          requireInteraction: true,
          ...(buttons ? { buttons } : {}),
        },
        () => {
          // Reading lastError keeps a failed create from logging as unchecked.
          void API.runtime.lastError;
          resolve();
        },
      );
    } catch {
      resolve();
    }
  });
}

const breakIntervalMs = (settings) =>
  Math.max(1, asObject(settings.breaks).everyMin || 45) * MIN;

/** Moves the break clock to an absolute time. */
async function setBreakNextAt(at) {
  const bag = await readLocal("data");
  const data = asObject(bag.data);
  data.breakState = { ...asObject(data.breakState), nextAt: at };
  await writeLocal({ data });
}

/**
 * Everything due now plus when the next thing is due.
 * @returns {Promise<{due: Array<object>, nextAt: number}>}
 */
async function collectDue() {
  const bag = await readLocal(["data", "settings"]);
  const data = asObject(bag.data);
  const settings = asObject(bag.settings);
  const now = Date.now();
  const due = [];
  let nextAt = Infinity;

  const consider = (item) => {
    if (item.at <= now) due.push(item);
    else if (item.at < nextAt) nextAt = item.at;
  };

  const breaks = asObject(settings.breaks);
  if (breaks.enabled) {
    const every = breakIntervalMs(settings);
    let at = Number(asObject(data.breakState).nextAt) || 0;
    // An unarmed clock, or one implausibly far out because the machine slept
    // for a week, starts a fresh interval instead of firing a backlog.
    if (!at || at > now + every + MIN) at = now + every;
    consider({
      kind: "break",
      key: `break_${at}`,
      at,
      title: "Time for a break",
      message: breaks.message || DEFAULT_BREAK_MESSAGE,
      buttons: [{ title: "Snooze 5 min" }],
    });
  }

  const muted = Number(data.remindersMutedBefore) || 0;
  const todos = Array.isArray(data.todos) ? data.todos : [];
  for (const t of todos) {
    if (!t || t.done) continue;
    const parsed =
      Number.isInteger(t.remindH) && Number.isInteger(t.remindM)
        ? { h: t.remindH, min: t.remindM }
        : parseReminderTime(t.text);
    if (!parsed) continue;
    const at = timeOn(now, parsed.h, parsed.min);
    if (at < muted) continue;
    consider({
      kind: "todo",
      key: `todo_${t.id}_${todayKey(now)}_${parsed.h}:${parsed.min}`,
      at,
      title: "Reminder",
      message: String(t.text || "").slice(0, 200),
    });
  }

  return { due, nextAt };
}

let running = false;

async function runReminders() {
  if (!API?.alarms || running) return;
  running = true;
  try {
    const { due, nextAt } = await collectDue();
    const now = Date.now();
    const watching = await pageIsWatching();

    for (const item of due) {
      // Hands off entirely while a page is on screen — deliberately *before*
      // claiming. Claiming and then staying quiet would take the reminder away
      // from the page that was about to show it, and nobody would announce it.
      // Nothing is lost by skipping: the break clock is left untouched, so the
      // item is still due at the next alarm if the page turned out to be gone.
      if (watching) continue;

      // A nudge missed by hours is not worth announcing late: claim it so it
      // stays quiet, and let the next interval start clean.
      const stale = now - item.at > CATCHUP_MS;
      if (!(await claimFire(item.key))) continue;
      if (item.kind === "break") {
        const cur = asObject((await readLocal("settings")).settings);
        await setBreakNextAt(now + breakIntervalMs(cur));
      }
      if (stale) continue;

      flashBadge(item.kind === "break" ? "☕" : "⏰", "#6366f1");
      await notify(`et:${item.kind}:${item.key}`, item.title, item.message, item.buttons);
    }

    // Firing a break moves its clock, so the `nextAt` computed above is stale
    // the moment anything fired. Re-collecting aims the alarm at the real next
    // reminder instead of falling back to a blind five-minute poll.
    const upcoming = due.length ? (await collectDue()).nextAt : nextAt;

    // Chrome clamps alarms to a one-minute floor, which is fine: the page
    // covers sub-minute precision whenever it is actually open.
    const delay =
      upcoming === Infinity ? 5 * MIN : Math.max(0, upcoming - Date.now());
    await API.alarms.create(REMINDER_ALARM, {
      delayInMinutes: Math.max(0.5, delay / MIN),
    });
  } catch {
  } finally {
    running = false;
  }
}

API?.alarms?.onAlarm?.addListener((alarm) => {
  if (alarm.name === REMINDER_ALARM) runReminders();
});

API?.notifications?.onButtonClicked?.addListener(async (id) => {
  // The break nudge carries the only button any of these notifications has.
  if (!String(id).startsWith("et:break:")) return;
  await setBreakNextAt(Date.now() + SNOOZE_MS);
  try {
    API.notifications.clear(id);
  } catch {}
  runReminders();
});

API?.notifications?.onClicked?.addListener((id) => {
  if (!String(id).startsWith("et:")) return;
  try {
    API.notifications.clear(id);
  } catch {}
});

// Settings and todo edits move when the next nudge is due, so the alarm is
// recomputed rather than left pointing at a stale time.
API?.storage?.onChanged?.addListener((changes, area) => {
  if (area !== "local") return;
  if (!changes.data && !changes.settings) return;
  runReminders();
});

API?.runtime?.onStartup?.addListener(() => runReminders());
API?.runtime?.onInstalled?.addListener(() => runReminders());
runReminders();
