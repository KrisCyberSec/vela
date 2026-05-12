// Ask Vela monthly soft-cap (client-side hint).
//
// Generous so power users never feel rationed mid-month. Math sanity at
// max abuse: 250 calls/mo × $0.0017/call = $0.43/user/mo, which is 7%
// of the $5.83/mo subscription net. Realistic average is 5 to 10
// questions per month per user. The real defenses are server-side
// (30/24h per user, $50/day shared global ceiling); this client cap
// is the friendly UI hint, not the security boundary.

export const ASK_VELA_MONTHLY_CAP = 250;
export const ASK_VELA_COUNT_KEY = "vela_ask_monthly_count";

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthlyCount() {
  try {
    const raw = JSON.parse(localStorage.getItem(ASK_VELA_COUNT_KEY) || "null");
    if (!raw || raw.month !== currentMonthKey()) return 0;
    return raw.count || 0;
  } catch { return 0; }
}

export function checkAndUpdateMonthlyCap() {
  const month = currentMonthKey();
  let raw;
  try { raw = JSON.parse(localStorage.getItem(ASK_VELA_COUNT_KEY) || "null"); } catch { raw = null; }
  if (!raw || raw.month !== month) raw = { month, count: 0 };
  if (raw.count >= ASK_VELA_MONTHLY_CAP) {
    const next = new Date();
    next.setMonth(next.getMonth() + 1, 1);
    return {
      ok: false,
      resetsOn: next.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
    };
  }
  raw.count += 1;
  try { localStorage.setItem(ASK_VELA_COUNT_KEY, JSON.stringify(raw)); } catch { /* private mode */ }
  return { ok: true, count: raw.count };
}

export function bumpMonthlyCapTo(target) {
  const month = currentMonthKey();
  try { localStorage.setItem(ASK_VELA_COUNT_KEY, JSON.stringify({ month, count: target })); } catch {}
}
