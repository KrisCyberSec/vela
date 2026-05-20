// Canonical symptom catalog + helpers.
//
// Icons reference Phosphor component names (rendered via SymptomIcon in
// App.jsx, duotone weight). Custom user-defined symptoms use the literal
// "✦" glyph and are tracked in localStorage separately.
//
// Order within each category is the order shown in the Today symptom-tile
// grid; preserve it when adding new symptoms unless you have a reason.

export const SYMPTOMS = [
  // Most common (shown first)
  { icon: "Flame", name: "Hot flash", cat: "common" },
  { icon: "MoonStars", name: "Night sweats", cat: "common" },
  { icon: "Bed", name: "Poor sleep", cat: "common" },
  { icon: "Brain", name: "Brain fog", cat: "common" },
  { icon: "HeartHalf", name: "Mood shifts", cat: "common" },
  { icon: "BatteryLow", name: "Fatigue", cat: "common" },
  { icon: "CloudLightning", name: "Anxiety", cat: "common" },
  { icon: "Lightning", name: "Irritability", cat: "common" },
  // Mood & cognitive
  { icon: "CloudMoon", name: "Depression", cat: "mood" },
  { icon: "Heartbeat", name: "Panic attacks", cat: "mood" },
  { icon: "Question", name: "Memory lapse", cat: "mood" },
  { icon: "ChatTeardrop", name: "Word-finding difficulty", cat: "mood" },
  { icon: "Target", name: "Difficulty concentrating", cat: "mood" },
  { icon: "Waveform", name: "Mood swings", cat: "mood" },
  { icon: "HourglassLow", name: "Low motivation", cat: "mood" },
  // Physical
  { icon: "Aperture", name: "Headache", cat: "physical" },
  { icon: "Sparkle", name: "Migraine", cat: "physical" },
  { icon: "Bone", name: "Joint pain", cat: "physical" },
  { icon: "PersonSimple", name: "Muscle aches", cat: "physical" },
  { icon: "PersonSimple", name: "Back pain", cat: "physical" },
  { icon: "Heartbeat", name: "Palpitations", cat: "physical" },
  { icon: "Snowflake", name: "Chills", cat: "physical" },
  { icon: "ArrowsClockwise", name: "Dizziness", cat: "physical" },
  { icon: "SpeakerHigh", name: "Tinnitus", cat: "physical" },
  { icon: "Hand", name: "Tingling/numbness", cat: "physical" },
  { icon: "Footprints", name: "Restless legs", cat: "physical" },
  { icon: "Drop", name: "Hair thinning", cat: "physical" },
  { icon: "SunDim", name: "Dry skin", cat: "physical" },
  { icon: "Heart", name: "Breast tenderness", cat: "physical" },
  { icon: "Scales", name: "Weight change", cat: "physical" },
  // Intimate health
  { icon: "Drop", name: "Vaginal dryness", cat: "intimate" },
  { icon: "Flame", name: "Vaginal irritation", cat: "intimate" },
  { icon: "HeartBreak", name: "Low libido", cat: "intimate" },
  { icon: "DropHalfBottom", name: "Urinary urgency", cat: "intimate" },
  { icon: "Drop", name: "Incontinence", cat: "intimate" },
  // Digestive
  { icon: "Circle", name: "Bloating", cat: "digestive" },
  { icon: "Smiley", name: "Nausea", cat: "digestive" },
  { icon: "ArrowUp", name: "Acid reflux", cat: "digestive" },
  { icon: "Repeat", name: "Digestive changes", cat: "digestive" },
  // Other
  { icon: "Wind", name: "Shortness of breath", cat: "other" },
  { icon: "Drop", name: "Dry mouth", cat: "other" },
  { icon: "Eye", name: "Dry eyes", cat: "other" },
  { icon: "Tooth", name: "Gum problems", cat: "other" },
  { icon: "Bug", name: "Crawling skin", cat: "other" },
];

// Set of canonical symptom names. Used by the off-device payload builders
// (buildAskVelaSummary, buildDailyBriefSummary) to scrub user-defined
// custom symptom names before the request leaves the device — see the
// "What Ask Vela sends" row in Settings, which promises no custom-symptom
// names go off-device.
export const CANONICAL_SYMPTOM_NAMES = new Set(SYMPTOMS.map((s) => s.name));

// Maps an onboarding concern index (Q1) to the canonical symptom names
// that concern is mostly about. Used to bubble the user's flagged symptoms
// to the front of each category's tile list and to give Ask Vela / Daily
// Brief richer profile context.
//
// Keep this aligned with QUESTIONS[1].opts in ./questions.jsx. Order
// within each array puts the most-likely-meant symptom first.
export const CONCERN_TO_SYMPTOM_NAMES = {
  0: ["Hot flash", "Night sweats"],                              // hot flashes & night sweats
  1: ["Poor sleep"],                                              // sleep problems
  2: ["Mood shifts", "Anxiety", "Mood swings", "Depression"],     // mood & anxiety
  3: ["Brain fog", "Fatigue", "Difficulty concentrating"],        // brain fog & fatigue
  4: ["Joint pain", "Muscle aches", "Back pain"],                 // joint pain & body aches
  5: ["Weight change", "Bloating"],                               // weight & bloating
  6: ["Low libido", "Vaginal dryness", "Vaginal irritation"],     // libido & dryness
  7: ["Palpitations"],                                            // heart palpitations
};

// Returns the symptom list for a given category, with the user's
// onboarding-flagged concerns sorted to the top while preserving the
// canonical order within each bucket.
export function prioritizedSymptomsForCat(allSymptoms, cat, concerns) {
  const inCat = allSymptoms.filter((s) => s.cat === cat);
  if (!concerns || concerns.length === 0) return inCat;
  const flagged = new Set(
    concerns.flatMap((c) => CONCERN_TO_SYMPTOM_NAMES[c] || [])
  );
  // Stable partition: flagged-in-cat first (preserving SYMPTOMS order),
  // then the rest (also preserving SYMPTOMS order).
  const matched = inCat.filter((s) => flagged.has(s.name));
  const others = inCat.filter((s) => !flagged.has(s.name));
  return [...matched, ...others];
}

export const MOODS = ["rough", "low", "okay", "good", "great"];
