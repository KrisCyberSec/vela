// Date / time / streak / greeting helpers.
//
// Two non-obvious things in here:
//   - localDateStr / localISOString deliberately use local-tz parts
//     because UTC-based date.toISOString().slice(0, 10) shifts the
//     calendar day for evening users in western timezones. Logs are
//     queried by `entry.date.slice(0, 10)` so this matters.
//   - getStreak respects vela_streak_freezes (days the user paused
//     intentionally). Freezes count as streak days; an unfrozen gap
//     breaks the streak.

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Adaptive greeting. When a user hasn't logged in 3+ days the generic
// time-of-day greeting reads as oblivious. Replace it with a direct,
// no-cheer-filler acknowledgement of the gap. The 45-55 audience would
// rather hear "you haven't logged in 4 days" than "Welcome back!"
export function getAdaptiveGreeting(logs) {
  if (!logs || logs.length === 0) return getGreeting();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let mostRecent = null;
  for (const l of logs) {
    const d = new Date(l.date); d.setHours(0, 0, 0, 0);
    if (!mostRecent || d > mostRecent) mostRecent = d;
  }
  if (!mostRecent) return getGreeting();
  const daysAgo = Math.floor((today - mostRecent) / (1000 * 60 * 60 * 24));
  if (daysAgo >= 14) return "It's been a couple weeks";
  if (daysAgo >= 7) return "It's been over a week";
  if (daysAgo >= 3) return `You haven't logged in ${daysAgo} days`;
  return getGreeting();
}

// Get YYYY-MM-DD in local timezone (avoids UTC date shift bug).
export function localDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Full ISO string in local timezone (not UTC). Stored on every log entry
// so that `entry.date.slice(0, 10)` matches the user's local day, not UTC.
// Critical for evening users in western timezones whose UTC clock has
// already rolled to tomorrow.
export function localISOString(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const tzAbs = Math.abs(tz);
  return (
    date.getFullYear() +
    "-" + pad(date.getMonth() + 1) +
    "-" + pad(date.getDate()) +
    "T" + pad(date.getHours()) +
    ":" + pad(date.getMinutes()) +
    ":" + pad(date.getSeconds()) +
    "." + String(date.getMilliseconds()).padStart(3, "0") +
    sign + pad(Math.floor(tzAbs / 60)) +
    ":" + pad(tzAbs % 60)
  );
}

export function getStreak(logs) {
  if (logs.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  const freezes = (() => { try { return JSON.parse(localStorage.getItem("vela_streak_freezes") || "[]"); } catch { return []; } })();
  for (let i = 0; i <= 120; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStr = localDateStr(d);
    const hasLog = logs.some((l) => l.date.slice(0, 10) === dayStr);
    const isFrozen = freezes.includes(dayStr);
    if (hasLog) streak++;
    else if (isFrozen && i > 0) streak++; // freeze counts as a streak day
    else if (i > 0) break;
    else break; // today with no log and no freeze
  }
  return streak;
}

export function getJourneyLabel(profileIndex) {
  const labels = [
    "regular cycles",
    "perimenopause",
    "postmenopause",
    "surgical menopause",
  ];
  return labels[profileIndex] || null;
}
