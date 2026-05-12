// Gamification helpers — XP, levels, badges, streak multiplier.
// BADGES and LEVELS are data tables; the rest derive stats from logs.
// Surfaced on the Settings screen and via the milestone celebration
// when a level threshold is crossed on a successful log save.

import { getStreak } from "./formatters";


export const BADGES = [
  // Streak badges
  { id: "streak-3", icon: "🌱", name: "Seedling", desc: "3-day logging streak", check: (s) => s.streak >= 3 },
  { id: "streak-7", icon: "🌿", name: "Sprouting", desc: "7-day logging streak", check: (s) => s.streak >= 7 },
  { id: "streak-14", icon: "🌳", name: "Taking Root", desc: "14-day logging streak", check: (s) => s.streak >= 14 },
  { id: "streak-30", icon: "🌲", name: "Deeply Rooted", desc: "30-day logging streak", check: (s) => s.streak >= 30 },
  { id: "streak-60", icon: "🏔️", name: "Mountain Strong", desc: "60-day logging streak", check: (s) => s.streak >= 60 },
  // Logging milestones
  { id: "logs-1", icon: "✨", name: "First Step", desc: "Log your first entry", check: (s) => s.totalLogs >= 1 },
  { id: "logs-10", icon: "📝", name: "Getting Started", desc: "Log 10 entries", check: (s) => s.totalLogs >= 10 },
  { id: "logs-50", icon: "📊", name: "Data Builder", desc: "Log 50 entries", check: (s) => s.totalLogs >= 50 },
  { id: "logs-100", icon: "🏆", name: "Century Club", desc: "Log 100 entries", check: (s) => s.totalLogs >= 100 },
  { id: "logs-365", icon: "👑", name: "Year of Wisdom", desc: "Log 365 entries", check: (s) => s.totalLogs >= 365 },
  // Feature discovery
  { id: "mood-first", icon: "😊", name: "Mood Tracker", desc: "Log your first mood", check: (s) => s.moodLogs >= 1 },
  { id: "notes-first", icon: "📓", name: "Journaler", desc: "Add your first note", check: (s) => s.notesCount >= 1 },
  { id: "context-first", icon: "🔍", name: "Context Seeker", desc: "Log sleep, stress, or a trigger", check: (s) => s.contextLogs >= 1 },
  { id: "symptoms-5", icon: "🩺", name: "Body Listener", desc: "Track 5 different symptoms", check: (s) => s.uniqueSymptoms >= 5 },
  { id: "symptoms-10", icon: "🧬", name: "Full Spectrum", desc: "Track 10 different symptoms", check: (s) => s.uniqueSymptoms >= 10 },
  // Community
  { id: "community-post", icon: "💬", name: "Voice Found", desc: "Write your first community post", check: (s) => s.communityPosts >= 1 },
  { id: "community-5", icon: "🤝", name: "Supporter", desc: "Write 5 community posts", check: (s) => s.communityPosts >= 5 },
  // Insights
  { id: "insight-first", icon: "💡", name: "Pattern Spotter", desc: "View your first weekly insight", check: (s) => s.uniqueDays >= 7 },
  { id: "ai-chat", icon: "🤖", name: "Vela Whisperer", desc: "Ask Vela your first question", check: (s) => s.aiChats >= 1 },
  // Special
  { id: "weekend-warrior", icon: "🦸", name: "Weekend Warrior", desc: "Log on both Saturday and Sunday", check: (s) => s.weekendLogs >= 2 },
  { id: "night-owl", icon: "🦉", name: "Night Owl", desc: "Log after 10pm", check: (s) => s.nightLogs >= 1 },
  { id: "early-bird", icon: "🐦", name: "Early Bird", desc: "Log before 7am", check: (s) => s.earlyLogs >= 1 },
  { id: "period-tracker", icon: "🩸", name: "Cycle Aware", desc: "Log period data for the first time", check: (s) => s.periodLogs >= 1 },
];

// Level names are quiet status markers, not aspirational badges. We
// explicitly avoid "journey," "wellness," and "empowered" (per brand
// voice), and we don't claim patterns "emerge" before there's enough
// data to back it up — early-level unlocks are about commitment, later
// ones reflect actual analytical depth.
export const LEVELS = [
  { level: 1, name: "Logged in", xpNeeded: 0, unlock: null },
  { level: 2, name: "A few days in", xpNeeded: 50, unlock: "Steady start. Vela's listening." },
  { level: 3, name: "Finding your rhythm", xpNeeded: 150, unlock: "A week of data is enough to see the first signal." },
  { level: 4, name: "Seeing connections", xpNeeded: 350, unlock: "Cross-symptom triggers are starting to surface." },
  { level: 5, name: "Knowing your body", xpNeeded: 600, unlock: "Multi-week patterns are taking shape." },
  { level: 6, name: "Steady tracker", xpNeeded: 1000, unlock: "You can name your triggers." },
  { level: 7, name: "Long-haul", xpNeeded: 1500, unlock: "A year of data tells a real story." },
  { level: 8, name: "Documented", xpNeeded: 2200, unlock: "You've built a record any provider would respect." },
  { level: 9, name: "Anchored", xpNeeded: 3000, unlock: "You've been here through the hard stretches." },
  { level: 10, name: "Vela companion", xpNeeded: 4000, unlock: "You've built a complete picture of your health." },
];

export function computeGamificationStats(logs) {
  const streak = getStreak(logs);
  const totalLogs = logs.length;
  const uniqueSymptoms = new Set(logs.flatMap((l) => Object.keys(l.symptoms || {}))).size;
  const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  const moodLogs = logs.filter((l) => l.mood !== null && l.mood !== undefined).length;
  const notesCount = logs.filter((l) => l.notes && l.notes.trim()).length;
  const contextLogs = logs.filter((l) => l.context && Object.values(l.context).some((v) => v !== null)).length;
  const communityPosts = (() => { try { return JSON.parse(localStorage.getItem("vela_community_posts") || "[]").length; } catch { return 0; } })();
  const aiChats = (() => { try { return JSON.parse(localStorage.getItem("vela_chat_messages") || "[]").filter((m) => m.role === "user").length; } catch { return 0; } })();
  const weekendLogs = new Set(logs.filter((l) => { const d = new Date(l.date).getDay(); return d === 0 || d === 6; }).map((l) => new Date(l.date).getDay())).size;
  const nightLogs = logs.filter((l) => new Date(l.date).getHours() >= 22).length;
  const earlyLogs = logs.filter((l) => new Date(l.date).getHours() < 7).length;
  const periodLogs = logs.filter((l) => l.context?.period && l.context.period !== "none").length;
  return { streak, totalLogs, uniqueSymptoms, uniqueDays, moodLogs, notesCount, contextLogs, communityPosts, aiChats, weekendLogs, nightLogs, earlyLogs, periodLogs };
}

export function getStreakMultiplier(streak) {
  if (streak >= 30) return 3;
  if (streak >= 14) return 2;
  if (streak >= 7) return 1.5;
  return 1;
}

export function computeXP(logs) {
  let xp = 0;
  const streak = getStreak(logs);
  const multiplier = getStreakMultiplier(streak);
  xp += logs.length * 10; // 10 XP per log
  const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  xp += uniqueDays * 5; // 5 XP bonus per unique day
  xp += Math.min(streak, 60) * 3; // 3 XP per streak day (cap at 60)
  // Streak multiplier bonus: extra XP for sustained streaks
  if (streak >= 7) xp += Math.floor(streak * (multiplier - 1) * 2);
  const moodLogs = logs.filter((l) => l.mood !== null && l.mood !== undefined).length;
  xp += moodLogs * 2; // 2 XP per mood log
  const contextLogs = logs.filter((l) => l.context && Object.values(l.context).some((v) => v !== null)).length;
  xp += contextLogs * 3; // 3 XP per context log
  const notesCount = logs.filter((l) => l.notes && l.notes.trim()).length;
  xp += notesCount * 5; // 5 XP per note
  const stats = computeGamificationStats(logs);
  const earned = BADGES.filter((b) => b.check(stats));
  xp += earned.length * 25; // 25 XP per badge
  // Lesson XP: 10 XP per completed daily lesson
  try {
    const completedLessons = JSON.parse(localStorage.getItem("vela_completed_lessons") || "[]");
    xp += completedLessons.length * 10;
  } catch {}
  return xp;
}

export function getLevel(xp) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.xpNeeded) current = lvl;
    else break;
  }
  const nextLevel = LEVELS.find((l) => l.xpNeeded > xp);
  const xpToNext = nextLevel ? nextLevel.xpNeeded - xp : 0;
  const xpInLevel = nextLevel ? xp - current.xpNeeded : 0;
  const xpLevelRange = nextLevel ? nextLevel.xpNeeded - current.xpNeeded : 1;
  const pct = nextLevel ? Math.round((xpInLevel / xpLevelRange) * 100) : 100;
  return { ...current, xp, xpToNext, pct, isMax: !nextLevel };
}
