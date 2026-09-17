const fs = require("fs");
const assert = require("assert");
const src = fs.readFileSync(__dirname + "/../js/ui/timer-notifications.js", "utf8");
const BackupReminder = new Function(src.slice(src.indexOf("const BackupReminder")) + "\nreturn BackupReminder;")();
const due = (s, now) => BackupReminder.isDue(s, new Date(now).getTime());
const since = new Date("2026-09-01T10:00:00").getTime();

const weekly = { backupFreq: "weekly", backupDay: 1, backupTime: "09:00", backupSince: since };
assert.equal(due(weekly, "2026-09-06T23:59:00"), false, "before first Monday");
assert.equal(due(weekly, "2026-09-07T08:59:00"), false, "Monday before time");
assert.equal(due(weekly, "2026-09-07T09:00:00"), true, "Monday at time");
assert.equal(due(weekly, "2026-09-10T12:00:00"), true, "still due later in week");
assert.equal(due({ ...weekly, lastBackupAt: new Date("2026-09-07T09:30:00").getTime() }, "2026-09-10T12:00:00"), false, "backed up after due");
assert.equal(due({ ...weekly, backupDismissedAt: new Date("2026-09-08T09:30:00").getTime() }, "2026-09-13T12:00:00"), false, "dismissed until next");
assert.equal(due({ ...weekly, backupDismissedAt: new Date("2026-09-08T09:30:00").getTime() }, "2026-09-14T09:01:00"), true, "due again next Monday");
assert.equal(due({ ...weekly, lastBackupAt: new Date("2030-01-01").getTime() }, "2026-09-14T09:01:00"), true, "future timestamp (clock skew) ignored");

const monthly = { backupFreq: "monthly", backupDate: 31, backupTime: "20:00", backupSince: since };
assert.equal(due(monthly, "2026-09-30T19:59:00"), false, "Sept has 30 days, before time");
assert.equal(due(monthly, "2026-09-30T20:00:00"), true, "31 clamps to Sept 30");
assert.equal(due({ ...monthly, backupSince: new Date("2028-02-01").getTime() }, "2028-02-29T20:00:00"), true, "leap Feb 29");

const daily = { backupFreq: "daily", backupTime: "00:00", backupSince: since };
assert.equal(due(daily, "2026-09-01T23:00:00"), false, "installed after today's time");
assert.equal(due(daily, "2026-09-02T00:00:00"), true, "midnight next day");

const custom = { backupFreq: "custom", backupEveryDays: 3, backupTime: "09:00", backupSince: since };
assert.equal(due(custom, "2026-09-04T08:00:00"), false);
assert.equal(due(custom, "2026-09-04T09:00:00"), true, "every 3 days");
assert.equal(due({ ...custom, lastBackupAt: new Date("2026-09-04T10:00:00").getTime() }, "2026-09-07T09:00:00"), true, "across DST-free span");
assert.equal(due({ ...custom, backupFreq: "off" }, "2027-01-01"), false, "off");
assert.equal(due({ backupFreq: "bogus", backupDay: 99, backupTime: "25:99", backupSince: since }, "2026-09-07T09:00:00"), true, "invalid values fall back to weekly Monday 09:00");
assert.equal(due({ backupFreq: "weekly" }, "2026-09-07T09:00:00"), false, "no since yet: never nags immediately");
const dst = { backupFreq: "custom", backupEveryDays: 2, backupTime: "09:00", backupSince: new Date("2026-10-30T10:00:00").getTime() };
assert.equal(due(dst, "2026-11-01T08:59:00"), false, "DST day before time");
assert.equal(due(dst, "2026-11-01T09:00:00"), true, "DST day at local time");
const dstWeekly = { ...weekly, backupSince: new Date("2026-10-27T10:00:00").getTime(), backupDay: 0 };
assert.equal(due(dstWeekly, "2026-11-01T09:00:00"), true, "weekly on a DST Sunday");
assert.equal(due({ ...dstWeekly, backupSince: new Date("2027-04-01T10:00:00").getTime() }, "2027-04-04T09:00:00"), true, "weekly on AU DST end Sunday");
console.log("backup reminder: all checks passed");
