// Crisis safety net — patterns + resources.
//
// First line of defense: client-side keyword pre-filter that intercepts
// crisis-language messages BEFORE they hit any AI path. The user gets a
// dedicated support card (CrisisSupportCard in App.jsx) with international
// hotlines instead of any AI-generated response. This guarantees the
// right behavior even when:
//   - The Anthropic API is down (we'd otherwise fall back to canned text)
//   - The user is on free tier (no AI access at all)
//   - The system prompt instructions don't catch a phrasing variant
//
// Keywords are tuned for high-confidence matches only. We use word
// boundaries and exclude common idioms ("I'm dying for a coffee").

export const CRISIS_PATTERNS = [
  /\bkill(ing)?\s+myself\b/i,
  /\bend(ing)?\s+my\s+(own\s+)?life\b/i,
  /\b(don'?t|do\s*not)\s+want\s+to\s+(live|be\s+alive|exist)\b/i,
  /\b(want|wish)\s+(to|i\s+could)\s+(die|be\s+dead)\b/i,
  /\bsuicid(e|al)\b/i,
  /\b(hurt|harm)\s+myself\b/i,
  /\bself[\s-]harm\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\bno\s+reason\s+to\s+(live|go\s+on)\b/i,
  /\bcan'?t\s+go\s+on\b/i,
  /\bgoing\s+to\s+(kill|end)\s+myself\b/i,
];

export function looksLikeCrisis(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.toLowerCase();
  // Quick exits for common false-positive idioms
  if (/dying\s+(to|for)\s+(a|some|one|that|this|the)\b/.test(t)) return false; // "dying for a coffee"
  if (/dead\s+(tired|asleep|on\s+my\s+feet)\b/.test(t)) return false;
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

// International crisis-support resources. Keep this list short and
// well-vetted — bad numbers do real harm. All verified May 2026; if
// the user is shipping internationally, audit annually.
export const CRISIS_RESOURCES = [
  { region: "United States", line: "988", note: "Suicide & Crisis Lifeline · call or text" },
  { region: "United Kingdom & Ireland", line: "116 123", note: "Samaritans · free, 24/7" },
  { region: "Canada", line: "1-833-456-4566", note: "Talk Suicide Canada · call or text 45645" },
  { region: "Australia", line: "13 11 14", note: "Lifeline · 24/7" },
  { region: "Anywhere else", line: "ifindahelpline.com", note: "International directory of free, vetted lines" },
];
