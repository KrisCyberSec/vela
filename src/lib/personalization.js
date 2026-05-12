// Personalization derived from onboarding answers.
// Pure function over the raw `profile` array stored in localStorage as
// `vela_profile`. Profile shape is index-based ([stage, concerns,
// goals, guidance]) for backward compat with existing user data.

// ─── Profile-Based Personalization Engine ─────────────────────────────────────

export function getPersonalization(profile) {
  if (!profile) return null;

  const stage = profile[0]; // 0=regular, 1=peri, 2=post, 3=surgical
  const concerns = Array.isArray(profile[1]) ? profile[1] : (profile[1] !== null && profile[1] !== undefined ? [profile[1]] : []);
  const goals = Array.isArray(profile[2]) ? profile[2] : (profile[2] !== null && profile[2] !== undefined ? [profile[2]] : []);
  const guidance = profile[3] ?? 3;

  // Concern indices: 0=hot flashes, 1=sleep, 2=mood, 3=brain fog, 4=joint pain, 5=weight, 6=libido, 7=palpitations

  // Map concerns to default symptom category
  const concernToCat = { 0: "common", 1: "common", 2: "mood", 3: "mood", 4: "physical", 5: "digestive", 6: "intimate", 7: "physical" };
  const defaultSymptomCat = concerns.length > 0 ? (concernToCat[concerns[0]] || "common") : "common";

  // Stage-aware greeting subtitles
  const stageMessages = [
    "Your cycle patterns matter. Tracking now builds a baseline for what's ahead.",
    "Your body is shifting. Each log helps Vela learn what's normal for you, so the changes ahead don't feel like guesswork.",
    "You've crossed the threshold. Tracking helps you understand what's settling and what's still adjusting.",
    "Surgical menopause moves on a different timeline. Vela adapts to what you're actually experiencing. Not a textbook average.",
  ];
  const stageMessage = stageMessages[stage] || stageMessages[1];

  // Goal-driven feature emphasis
  // 0=understand body, 1=track for doctor, 2=find relief, 3=connect with others
  const wantsDoctor = goals.includes(1);
  const wantsRelief = goals.includes(2);
  const wantsCommunity = goals.includes(3);
  const wantsUnderstanding = goals.includes(0);

  // Personalized welcome after onboarding
  const concernNames = {
    0: "hot flashes", 1: "sleep", 2: "mood", 3: "brain fog",
    4: "joint pain", 5: "weight", 6: "intimate health", 7: "palpitations",
  };
  const topConcernNames = concerns.slice(0, 2).map((c) => concernNames[c]).filter(Boolean);

  // Personalized companion greeting
  const companionGreeting = topConcernNames.length > 0
    ? `I'm here to help you understand your ${topConcernNames.join(" and ")} patterns. Ask me anything about your logged data.`
    : "I'm here to help you understand your symptom patterns. Ask me anything about your logged data.";

  return {
    stage, concerns, goals, guidance,
    defaultSymptomCat,
    stageMessage,
    wantsDoctor, wantsRelief, wantsCommunity, wantsUnderstanding,
    topConcernNames,
    companionGreeting,
  };
}
