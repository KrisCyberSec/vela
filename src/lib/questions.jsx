// Onboarding question definitions. Indices are persisted in
// localStorage as `vela_profile` (an array of answers), so the order
// here is part of the data model — do not reorder existing questions
// or option indices without a migration. New questions or options
// can be appended.
//
// Each question:
//   - text:     short prompt (used in Settings → edit a question)
//   - eyebrow:  pre-headline label, e.g. "About you"
//   - headline: JSX headline (italic <em> ok)
//   - sub:      one-sentence reassurance below the headline
//   - opts:     options. Each has { label, hint?, icon }
//   - multi:    if true, multi-select (e.g. concerns + goals)
//   - max:      cap on multi-select count

export const QUESTIONS = [
  {
    text: "Where are you in the transition?",
    eyebrow: "About you",
    headline: <>Where are you in the <em>transition?</em></>,
    sub: "There's no right answer. And you can change this any time. We use it to surface what's most relevant for your stage.",
    opts: [
      { label: "Still having regular periods", hint: "Cycles haven't shifted yet", icon: "Flower" },
      { label: "Periods are irregular (perimenopause)", hint: "Cycles still happen, but they're shifting", icon: "Sparkle" },
      { label: "No period for 12+ months", hint: "Well past the transition", icon: "SunHorizon" },
      { label: "Post-surgical menopause", hint: "Hysterectomy, cancer treatment, or other", icon: "FirstAidKit" },
    ],
  },
  {
    text: "Which symptoms bother you most?",
    multi: true,
    eyebrow: "What's on your mind",
    headline: <>What would you most like to <em>understand?</em></>,
    sub: "Pick up to five. We'll prioritize these on your daily check-in. Everything else is one tap away.",
    max: 5,
    opts: [
      { label: "Hot flashes & night sweats", icon: "Flame" },
      { label: "Sleep problems", icon: "Bed" },
      { label: "Mood changes & anxiety", icon: "HeartHalf" },
      { label: "Brain fog & fatigue", icon: "Brain" },
      { label: "Joint pain & body aches", icon: "Bone" },
      { label: "Weight changes & bloating", icon: "Scales" },
      { label: "Low libido & dryness", icon: "Drop" },
      { label: "Heart palpitations", icon: "Heartbeat" },
    ],
  },
  {
    text: "What's your main goal with Vela?",
    multi: true,
    eyebrow: "Why you're here",
    headline: <>What would feel like a <em>good outcome?</em></>,
    sub: "Pick anything that matters. We'll tune insights, prompts, and exports around what you select.",
    opts: [
      { label: "Understand what's happening to my body", hint: "Make sense of the patterns", icon: "MagnifyingGlass" },
      { label: "Track symptoms to show my doctor", hint: "Bring real data to appointments", icon: "FirstAidKit" },
      { label: "Find relief strategies", hint: "Test small changes, see what helps", icon: "Flask" },
      { label: "Connect with others going through this", hint: "Hear from others on the same path", icon: "ChatCircleText" },
    ],
  },
  {
    text: "How do you prefer to receive guidance?",
    eyebrow: "How we'll show up",
    headline: <>How much should Vela <em>nudge you?</em></>,
    sub: "Daily check-ins keep the most users consistent. But if you'd rather come to us, that works too. Change it any time.",
    opts: [
      { label: "Daily check-ins & reminders", hint: "A morning and evening nudge", icon: "Sun" },
      { label: "Weekly summaries", hint: "Sundays only. No pressure", icon: "Calendar" },
      { label: "Only when I ask", hint: "I'll come to the app", icon: "Hand" },
      { label: "Let the app decide", hint: "One evening nudge", icon: "Sparkle" },
    ],
  },
];
