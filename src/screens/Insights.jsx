// Insights / patterns screen. Surfaces the weekly hero, correlation findings,
// anomalies, cycle prediction, weekly summary, and experiments — plus the
// floating Ask Vela chat sheet (Claude-backed via /api/ask-vela with a canned
// fallback) and the doctor-report export trigger. All analytics run on-device
// from the logs prop; the screen is gated by uniqueDays (locked < 7) and
// further sub-gates Premium-only modules (cycle prediction, anomalies,
// experiments, Ask Vela). Persists chat history, experiments, and reveal
// state to localStorage.

import { useState, useEffect, useRef } from "react";

import { track } from "../analytics";
import { reportError } from "../errorReporting";
import { getAppUserId } from "../subscription";
import { readJSON as safeReadJSON } from "../safeStorage";
import { SymptomIcon, UIIcon, MoodFace } from "../components/icons";
import { CrisisSupportCard } from "../components/CrisisSupportCard";
import { SYMPTOMS } from "../lib/symptoms";
import { QUESTIONS } from "../lib/questions";
import { localDateStr } from "../lib/formatters";
import {
  ASK_VELA_MONTHLY_CAP,
  getMonthlyCount,
  checkAndUpdateMonthlyCap,
  bumpMonthlyCapTo,
} from "../lib/quota";
import { looksLikeCrisis } from "../lib/crisis";
import { analyzeCorrelations } from "../lib/correlations";
import {
  getInsightFeedback,
  insightKey,
  recordFeedback,
  applyFeedbackRanking,
} from "../lib/insightFeedback";
import { predictNextCycle } from "../lib/cycle";
import { detectAnomalies, anomalyToQuestion } from "../lib/anomalies";
import { buildWeeklySummary } from "../lib/patterns";
import { buildAskVelaSummary } from "../lib/summaries";
import { generateDoctorReport } from "../lib/doctorReport";
import { haptic } from "../lib/haptic";
import {
  EXPERIMENT_LIBRARY,
  compareExperiment,
  matchExperimentForInsight,
  suggestExperiments,
} from "../lib/experiments";
import { matchQuestion, generateResponse } from "../lib/cannedAI";

export default function InsightsScreen({ logs, profile, isPremium, onShowPaywall }) {
  // ─── Persistent Ask-Vela chat (kept from previous implementation) ──────────
  const [chatMessages, setChatMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vela_chat_messages")) || []; } catch { return []; }
  });
  const [chatInput, setChatInput] = useState("");
  // Mirror chatInput into a ref so cross-screen handoffs can peek at
  // the live value (used by the auto-submit timer to detect "user
  // started typing in the 600ms grace window — don't fire").
  const chatInputRef = useRef("");
  useEffect(() => { chatInputRef.current = chatInput; }, [chatInput]);
  const [isTyping, setIsTyping] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [revealDismissed, setRevealDismissed] = useState(() => !!localStorage.getItem("vela_insights_revealed"));
  // Monthly soft-cap UI state (the real cap is enforced server-side per
  // 24h; this is the friendly counter we show in the sheet).
  const [monthlyAsked, setMonthlyAsked] = useState(() => getMonthlyCount());
  const [remainingToday, setRemainingToday] = useState(null);

  useEffect(() => {
    if (chatMessages.length > 0) localStorage.setItem("vela_chat_messages", JSON.stringify(chatMessages.slice(-20)));
  }, [chatMessages]);

  // Cross-screen pickup: when another screen ("Ask Vela about this day"
  // from History, etc.) stashes a pending question, open the sheet
  // pre-loaded with it on mount. Stash gets cleared so it doesn't
  // re-fire on subsequent visits.
  useEffect(() => {
    let pending = null;
    try {
      pending = localStorage.getItem("vela_pending_question");
      if (pending) localStorage.removeItem("vela_pending_question");
    } catch { /* private mode */ }
    if (pending && pending.trim()) {
      setChatInput(pending);
      setAskOpen(true);
      // Auto-submit after a short delay so the sheet animates in first
      // and the user sees the typed-in question briefly before the AI
      // starts answering. Feels more natural than instant fire.
      // BUT: if the user starts typing during that 600ms (chatInputRef
      // diverges from pending), respect their edit and don't auto-fire.
      // They can submit on their own when ready.
      setTimeout(() => {
        const live = chatInputRef.current;
        if (live === pending) handleQuestion(pending);
      }, 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-screen pickup: when the daily brief on Today links an
  // experiment name, that tap stashes the libraryId here. We scroll
  // the matching active-experiment card into view and flash it
  // briefly so the user lands at the thing they tapped.
  useEffect(() => {
    let focusLib = null;
    try {
      focusLib = localStorage.getItem("vela_focus_experiment");
      if (focusLib) localStorage.removeItem("vela_focus_experiment");
    } catch { /* private mode */ }
    if (!focusLib) return;
    setTimeout(() => {
      const list = (() => {
        try { return JSON.parse(localStorage.getItem("vela_experiments") || "[]"); }
        catch { return []; }
      })();
      const exp = list.find((e) => e.libraryId === focusLib && e.status === "active");
      if (!exp) return;
      const el = document.getElementById(`exp-card-${exp.id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1800);
    }, 220);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuestion = async (text) => {
    if (!text.trim() || isTyping) return;
    track("ask_vela_used", { logCount: logs.length, gatedByDataMin: logs.length < 7 });
    track("ask_vela_started", { logCount: logs.length, dataReady: logs.length >= 7 });
    const userMsg = { role: "user", text: text.trim(), time: new Date().toISOString() };
    setChatMessages([...chatMessages, userMsg]);
    setChatInput("");
    setIsTyping(true);
    haptic("Light");

    // CRISIS SAFETY — first check, before everything else. We never send
    // crisis-language messages to AI or canned engines; the user gets the
    // dedicated CrisisSupportCard rendered inline as the assistant turn.
    if (looksLikeCrisis(text)) {
      track("crisis_intercepted", {});
      track("ask_vela_failed", { reason: "crisis_intercepted" });
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        crisis: true, // sentinel — chat renderer shows CrisisSupportCard
        time: new Date().toISOString(),
      }]);
      setIsTyping(false);
      haptic("Medium");
      return;
    }

    // Pre-flight: too little data for a meaningful answer
    if (logs.length < 7) {
      track("ask_vela_failed", { reason: "insufficient_data", logCount: logs.length });
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        text: `I need at least 7 days of entries to spot meaningful patterns. You're on day ${logs.length}. Keep going.`,
        time: new Date().toISOString(),
      }]);
      setIsTyping(false);
      haptic("Light");
      return;
    }

    // Pre-flight: client-side soft cap (20 questions/month). Server-side
    // rate limit is the real defense; this is just a friendly heads-up
    // that prevents us from making round-trips we know will fail.
    const monthCap = checkAndUpdateMonthlyCap();
    if (!monthCap.ok) {
      track("ask_vela_failed", { reason: "client_monthly_cap" });
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        text: `You've asked your monthly limit of ${ASK_VELA_MONTHLY_CAP} questions. The cap resets ${monthCap.resetsOn}. Until then, the existing answers in this thread stay available.`,
        time: new Date().toISOString(),
      }]);
      setIsTyping(false);
      return;
    }

    try {
      const summary = buildAskVelaSummary(logs);
      // profile is the raw onboarding answers object: { 0: stageIdx, 1: [concernIdxs], 2: goalIdx-or-array, 3: guidanceIdx }
      const stageIdx = profile?.[0];
      const concernAns = profile?.[1];
      const goalAns = profile?.[2];
      const concernIdxs = Array.isArray(concernAns) ? concernAns : (concernAns != null ? [concernAns] : []);
      const goalIdxs = Array.isArray(goalAns) ? goalAns : (goalAns != null ? [goalAns] : []);
      const profilePayload = {
        stage: stageIdx != null ? QUESTIONS[0].opts[stageIdx]?.label : null,
        concerns: concernIdxs.map((i) => QUESTIONS[1].opts[i]?.label).filter(Boolean),
        goals: goalIdxs.map((i) => QUESTIONS[2].opts[i]?.label).filter(Boolean),
        // Legacy single-goal field; ask-vela.js still reads this.
        goal: goalIdxs.length ? QUESTIONS[2].opts[goalIdxs[0]]?.label : null,
      };
      const appUserId = await getAppUserId();
      // Try the real API first; fall back to the canned response engine
      // if the function returns 5xx (key missing, model unreachable, etc.)
      const headers = { "Content-Type": "application/json" };
      // Local dev only: send the dev-bypass header so the function skips
      // RevenueCat verification (no Apple receipts on web). The token must
      // match ASK_VELA_DEV_TOKEN in .env.local — both default to "dev".
      if (process.env.NODE_ENV === "development" && process.env.REACT_APP_ASK_VELA_DEV_TOKEN) {
        headers["x-dev-token"] = process.env.REACT_APP_ASK_VELA_DEV_TOKEN;
      }
      const r = await fetch("/api/ask-vela", {
        method: "POST",
        headers,
        body: JSON.stringify({ question: text.trim(), summary, profile: profilePayload, appUserId }),
      });
      let answer;
      let serverRemaining = null;
      if (r.ok) {
        const data = await r.json();
        answer = data.answer;
        if (typeof data.remainingToday === "number") serverRemaining = data.remainingToday;
        track("ask_vela_succeeded", { cached: !!data.cached });
      } else if (r.status === 429) {
        // Rate-limited by server (per-user or per-IP cap hit). Skip the
        // canned fallback — the user needs to know they hit the limit.
        const data = await r.json().catch(() => ({}));
        answer = data.detail || "You've hit today's question limit. Try again later.";
        track("ask_vela_failed", { reason: "server_rate_limited" });
        // Sync our local counter to the server's view so the UI reflects truth
        bumpMonthlyCapTo(ASK_VELA_MONTHLY_CAP);
      } else if (r.status === 503) {
        const data = await r.json().catch(() => ({}));
        answer = data.detail || "Ask Vela is taking a break. Try again later.";
        track("ask_vela_failed", { reason: "server_unavailable" });
      } else if (r.status === 401 || r.status === 403) {
        const data = await r.json().catch(() => ({}));
        answer = data.detail || "Couldn't verify your subscription. Try restoring your purchase from Settings.";
        track("ask_vela_failed", { reason: "subscription_required" });
      } else {
        // Other failure — graceful degradation to canned response so the
        // user always gets *something*
        answer = generateResponse(matchQuestion(text), logs, profile);
        track("ask_vela_failed", { reason: "server_error_fallback" });
      }
      setChatMessages((prev) => [...prev, { role: "assistant", text: answer, time: new Date().toISOString() }]);
      if (serverRemaining != null) setRemainingToday(serverRemaining);
    } catch (err) {
      // Network failure on the Ask Vela request. We gracefully fall back
      // to the canned response, but log the underlying error so we can
      // see at scale whether the failure is e.g. the function timing out,
      // returning malformed JSON, or hitting a CDN edge case.
      reportError(err, { tag: "ask_vela_fetch_failed" });
      track("ask_vela_failed", { reason: "network_fallback" });
      const answer = generateResponse(matchQuestion(text), logs, profile);
      setChatMessages((prev) => [...prev, { role: "assistant", text: answer, time: new Date().toISOString() }]);
    } finally {
      setIsTyping(false);
      haptic("Light");
      // Always refresh the local monthly count after a real attempt
      setMonthlyAsked(getMonthlyCount());
    }
  };

  // ─── Data-state derivation ────────────────────────────────────────────────
  const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  const dataState =
    uniqueDays === 0 || uniqueDays < 7 ? "locked"
    : uniqueDays === 7 && !revealDismissed ? "unlocked"
    : "rich";
  const isLocked = dataState === "locked";

  function dismissReveal() {
    localStorage.setItem("vela_insights_revealed", "1");
    setRevealDismissed(true);
    haptic("Medium");
  }

  // ─── Last 7 days analytics ────────────────────────────────────────────────
  const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
  const now = new Date();
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const dayStr = localDateStr(d); // local-date so it matches log.date stamps
    const dayLogs = logs.filter((l) => l.date.slice(0, 10) === dayStr);
    const symptomNames = new Set();
    let moodSum = 0, moodCount = 0;
    let hasPeriod = false;
    dayLogs.forEach((l) => {
      Object.keys(l.symptoms || {}).forEach((s) => symptomNames.add(s));
      if (l.mood !== null && l.mood !== undefined) { moodSum += l.mood; moodCount++; }
      if (l.context?.period && l.context.period !== "none") hasPeriod = true;
    });
    week.push({
      day: DAY_LETTERS[d.getDay()],
      count: symptomNames.size,
      mood: moodCount > 0 ? Math.round(moodSum / moodCount) : null,
      hasPeriod,
    });
  }
  const maxBar = Math.max(...week.map((w) => w.count), 1);

  // Top symptom across last 7 days
  const symFreq = {};
  week.forEach((w, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i));
    const dayStr = localDateStr(d);
    const dayLogs = logs.filter((l) => l.date.slice(0, 10) === dayStr);
    const seen = new Set();
    dayLogs.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => seen.add(s)));
    seen.forEach((s) => { symFreq[s] = (symFreq[s] || 0) + 1; });
  });
  const topSymptomEntry = Object.entries(symFreq).sort((a, b) => b[1] - a[1])[0];
  const topSymptomName = topSymptomEntry?.[0];
  const topSymptomDef = SYMPTOMS.find((s) => s.name === topSymptomName);

  // Avg mood label for week
  const moodSamples = week.filter((w) => w.mood !== null);
  const avgMoodIdx = moodSamples.length > 0
    ? Math.round(moodSamples.reduce((s, w) => s + w.mood, 0) / moodSamples.length)
    : null;
  // MoodFace replaces system emoji here — 45-55 audience finds emoji-yellow
  // smileys childish for a menopause app. MoodFace follows currentColor and
  // matches the rest of the duotone-Phosphor / earth-palette system.
  const MOOD_KIND = ["rough", "low", "okay", "good", "great"];
  const MOOD_LABEL = ["Rough", "Low", "Okay", "Good", "Great"];

  // Pull real correlations + apply user-feedback weighting. The new
  // analyzeCorrelations returns structured findings with adaptive
  // confidence labels and lag info; applyFeedbackRanking re-sorts by
  // user's thumbs-up history and hides things they've thumbs-down'd
  // 3+ times.
  const correlationsRaw = analyzeCorrelations(logs);
  const correlations = applyFeedbackRanking(correlationsRaw);
  const patternFindings = correlations.slice(0, 4).map((c) => ({
    icon: c.icon || "Sparkle",
    text: c.text,
    label: c.label,                          // "strong" | "steady" | "early"
    lag: c.lag || 0,
    basis: `${uniqueDays} days of data`,
    feedbackKey: insightKey(c),              // for thumbs persistence
    raw: c,                                   // pass for recordFeedback
  }));
  // Local state to re-render after a thumb is registered (so the
  // suppressed insight disappears or the helper text changes inline)
  const [, setFeedbackTick] = useState(0);
  const onPatternFeedback = (finding, vote) => {
    recordFeedback(finding.raw, vote);
    setFeedbackTick((n) => n + 1);
  };

  // Personal-baseline anomalies — premium-gated, surface only when present
  const anomalies = detectAnomalies(logs);

  // Cycle prediction (Premium-gated render below)
  const cyclePrediction = predictNextCycle(logs);

  // Experiments (Premium-gated render below). State is local so start/end
  // actions re-render without a full app round-trip; persistence is via
  // the safeStorage helper.
  const [experiments, setExperiments] = useState(() => safeReadJSON("vela_experiments", []));
  useEffect(() => {
    try { localStorage.setItem("vela_experiments", JSON.stringify(experiments)); } catch { /* private mode */ }
  }, [experiments]);
  const activeExperiments = experiments.filter((e) => e.status === "active");
  const completedExperiments = experiments.filter((e) => e.status === "completed");
  const [experimentBrowserOpen, setExperimentBrowserOpen] = useState(false);
  const [weekSheetOpen, setWeekSheetOpen] = useState(false);

  // Personalized experiment suggestions — premium-gated, derived from
  // detected correlations + top symptoms in the last 30 days.
  const experimentSuggestions = suggestExperiments(logs, experiments);

  // Weekly summary — computed live from logs. Card highlights on Sundays.
  const weeklySummary = buildWeeklySummary(logs);
  const isSunday = new Date().getDay() === 0;

  // Shy-mode for the Ask Vela FAB — hides when the user is scrolling
  // down (reading), reveals when scrolling up. Same pattern as iOS
  // Mail / Twitter compose buttons. Threshold + direction lock keeps
  // it from flickering on small jitter.
  const [fabHidden, setFabHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        if (Math.abs(dy) > 8) {
          if (dy > 0 && y > 240) setFabHidden(true);
          else if (dy < 0) setFabHidden(false);
          lastY = y;
        }
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  function startExperiment(library) {
    if (!isPremium) { onShowPaywall("experiment_start"); return; }
    const newExp = {
      id: `${library.id}_${Date.now()}`,
      libraryId: library.id,
      name: library.name,
      desc: library.desc,
      icon: library.icon,
      duration: library.duration,
      targets: library.targets,
      startDate: localDateStr(new Date()),
      status: "active",
    };
    setExperiments((prev) => [...prev, newExp]);
    setExperimentBrowserOpen(false);
    haptic("Medium");
    track("experiment_started", { libraryId: library.id, duration: library.duration });
  }

  function endExperiment(id) {
    setExperiments((prev) => prev.map((e) => e.id === id ? { ...e, status: "completed", endedAt: new Date().toISOString() } : e));
    haptic("Light");
  }

  function abandonExperiment(id) {
    setExperiments((prev) => prev.filter((e) => e.id !== id));
    haptic("Light");
  }

  // The legacy "Try this week" CBT shelf was removed when real
  // Experiments shipped — the EXPERIMENT_LIBRARY constant + the
  // Experiment browser sheet replaced it.

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const suggestedQs = [
    { text: <>What triggers my <em>hot flashes</em>?</> },
    { text: <>How does <em>sleep</em> shape my mood?</> },
    { text: <>Are my symptoms tied to my <em>cycle</em>?</> },
    { text: <>What's changed since I started <em>tracking</em>?</> },
    { text: <>Best questions to bring to my <em>doctor</em>?</> },
  ];

  return (
    <div className="screen active vela-app">
      {/* Slim header (Insights uses the global slim top header from App;
          we don't add a sticky vela-header here) */}

      {/* Greeting */}
      <section className="insights-greeting">
        <h1>Your <em>patterns.</em></h1>
        <p className="meta">
          {isLocked ? "Building baseline" : `Last 7 days · ${week.reduce((s, w) => s + (w.count > 0 ? 1 : 0), 0)} entries`}
          <span className="dot">·</span>{today}
        </p>
      </section>

      {/* LOCKED. Single state, no other modules */}
      {isLocked && (
        <section className="locked-card">
          <div className="lock-glyph"><UIIcon name="Lock" size={22} /></div>
          <h3>Patterns unlock at <em>day 7</em></h3>
          <p>
            You're {7 - uniqueDays} {7 - uniqueDays === 1 ? "day" : "days"} away. Vela needs a week of entries to
            spot rhythms in your symptoms. Anything sooner would be guessing.
          </p>
          <div className="locked-progress" aria-label={`${uniqueDays} of 7 days logged`}>
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className={`pip${i < uniqueDays ? " on" : ""}`} />
            ))}
          </div>
          <div className="locked-foot">{uniqueDays} of 7 days</div>
        </section>
      )}

      {/* UNLOCKED. Day 7 reveal hero */}
      {!isLocked && dataState === "unlocked" && (
        <section className="unlock-card">
          <div className="unlock-eyebrow">
            <UIIcon name="Sparkle" size={11} /> First pattern · Day 7
          </div>
          <h2 className="unlock-headline">
            {topSymptomDef ? (
              <>Your <em>{topSymptomName.toLowerCase()}</em> appeared {topSymptomEntry[1]} of 7 days this week.</>
            ) : (
              <>Your <em>first week</em> is complete. Patterns are forming.</>
            )}
          </h2>
          <p className="unlock-body">
            A starting signal. Your patterns sharpen with every week of logging. Keep going.
          </p>
          <div className="unlock-row">
            <button className="unlock-btn-primary" type="button" onClick={dismissReveal}>See the week</button>
            <button className="unlock-btn-secondary" type="button" onClick={dismissReveal}>Skip</button>
          </div>
        </section>
      )}

      {/* Established modules */}
      {!isLocked && dataState !== "unlocked" && (
        <>
          <section className="week-hero">
            <div className="week-eyebrow"><UIIcon name="Sparkle" size={11} /> This week</div>
            <p className="quote">
              {topSymptomDef
                ? <>Your top symptom this week: <em>{topSymptomName.toLowerCase()}</em>.</>
                : <>A <em>steady week</em> of logging. Keep going.</>}
            </p>
            <div className="week-stats">
              <div className="stat">
                <div className="v">{week.reduce((s, w) => s + (w.count > 0 ? 1 : 0), 0)}<span className="delta">/7</span></div>
                <div className="l">Days logged</div>
              </div>
              <div className="stat">
                <div className="v">{Object.keys(symFreq).length}</div>
                <div className="l">Symptoms</div>
              </div>
              <div className="stat">
                <div className="v" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--clay)", minHeight: 30 }}>
                  {avgMoodIdx !== null ? <MoodFace kind={MOOD_KIND[avgMoodIdx]} size={30} /> : "-"}
                </div>
                <div className="l">Avg mood</div>
              </div>
            </div>
          </section>

          {topSymptomDef && (
            <>
              <div className="today-section-label">
                <span>Top symptom</span>
                <span className="hint">7 days</span>
              </div>
              <section className="callout">
                <div className="callout-row">
                  <div className="callout-icon"><SymptomIcon name={topSymptomDef.icon} size={22} /></div>
                  <div className="callout-body">
                    <div className="callout-name">{topSymptomName}</div>
                    <div className="callout-meta">{topSymptomEntry[1]} of 7 days · most logged this week</div>
                  </div>
                  <span className="callout-trend up">↑ Top</span>
                </div>
              </section>
            </>
          )}

          <div className="today-section-label"><span>This week</span></div>
          <section className="bars-card">
            <div className="bars-head">
              <span className="bars-title">Symptom load · last 7 days</span>
              <span className="bars-sub">Daily count</span>
            </div>
            <div className="bars-grid">
              {week.map((w, i) => {
                const h = (w.count / maxBar) * 100;
                return (
                  <div key={i} className={`bar-col${w.count === 0 ? " dim" : ""}`}>
                    <div className="bar" style={{ height: `${Math.max(h, 6)}%` }} />
                    <span className="day">{w.day}</span>
                    {w.hasPeriod && <span className="period-dot" title="Period day" />}
                  </div>
                );
              })}
            </div>
            <div className="legend">
              <span><span className="swatch" style={{ background: "var(--clay)" }} /> Symptom count</span>
              <span><span className="swatch" style={{ background: "var(--sage)" }} /> Period day</span>
            </div>
          </section>

          <div className="today-section-label"><span>Mood</span></div>
          <section className="mood-row-card">
            <div className="bars-head" style={{ marginBottom: 4 }}>
              <span className="bars-title">Mood · last 7 days</span>
              <span className="bars-sub" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {avgMoodIdx !== null
                  ? <>Avg <span style={{ color: "var(--clay)", display: "inline-flex" }}><MoodFace kind={MOOD_KIND[avgMoodIdx]} size={16} /></span> {MOOD_LABEL[avgMoodIdx]}</>
                  : "Log to see"}
              </span>
            </div>
            <div className="mood-week">
              {week.map((w, i) => (
                <div key={i} className="mood-day">
                  <span className="em" style={{ color: "var(--clay)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    {w.mood !== null ? <MoodFace kind={MOOD_KIND[w.mood]} size={22} /> : "·"}
                  </span>
                  <span className="dot" style={{ background: w.mood !== null ? "var(--clay)" : undefined }} />
                  <span className="lab">{w.day}</span>
                </div>
              ))}
            </div>
            {moodSamples.length > 1 && (
              <p className="mood-summary">
                {moodSamples.length} of 7 days logged. Keep going to see week-over-week trends.
              </p>
            )}
          </section>

          {/* Sunday weekly summary — promoted on Sundays, present every
              other day as a quieter card. Premium-gated content; free
              tier sees the headline only and gets nudged to upgrade. */}
          {weeklySummary && (
            <button
              type="button"
              className={`week-summary-card${isSunday ? " sunday" : ""}${!isPremium ? " locked" : ""}`}
              onClick={() => isPremium ? setWeekSheetOpen(true) : onShowPaywall("weekly_summary")}
            >
              <div className="ws-eyebrow">
                <UIIcon name="Sparkle" size={11} />
                {isSunday ? "Your week" : "Last 7 days"}
                {!isPremium && <span className="ws-tag">Premium</span>}
              </div>
              <p className="ws-summary">
                {isPremium ? weeklySummary.summary : `${weeklySummary.daysLogged} of 7 days logged. Premium opens the full week-over-week comparison. Sleep, mood, top symptoms, and what shifted.`}
              </p>
              <div className="ws-foot">
                <span>{weeklySummary.daysLogged}/7 days</span>
                {weeklySummary.mood && <span>· mood {weeklySummary.mood.label}</span>}
                {weeklySummary.sleep && <span>· sleep {weeklySummary.sleep.avg.toFixed(1)}h</span>}
                <span className="ws-arrow"><UIIcon name="ArrowRight" size={13} /></span>
              </div>
            </button>
          )}

          {/* Cycle prediction (Premium) — only render when there's enough
              signal OR when free user, to surface the upsell */}
          {cyclePrediction && (
            <>
              <div className="today-section-label">
                <span>Cycle</span>
                {isPremium && cyclePrediction.cyclesLogged >= 2 && (
                  <span className="hint">
                    {cyclePrediction.confidence === "high" ? "High confidence" :
                     cyclePrediction.confidence === "medium" ? "Building confidence" : "Early signal"}
                  </span>
                )}
                {!isPremium && <span className="hint" style={{ color: "var(--gold)" }}>Premium</span>}
              </div>
              <section className={`cycle-card${!isPremium ? " locked" : ""}`}>
                {!isPremium ? (
                  <>
                    <div className="cycle-head">
                      <span className="ico"><UIIcon name="Sparkle" size={16} /></span>
                      <strong>Predict your next period</strong>
                    </div>
                    <p className="cycle-body">
                      Vela learns your rhythm. Even when cycles get irregular. And gives you a
                      window for what's likely next. Helpful for planning, travel, and naming
                      what your body's doing.
                    </p>
                    <button type="button" className="cycle-cta" onClick={() => onShowPaywall("cycle_prediction")}>
                      <UIIcon name="Star" size={13} weight="fill" /> Unlock with Premium
                    </button>
                  </>
                ) : cyclePrediction.cyclesLogged < 2 ? (
                  <>
                    <div className="cycle-head">
                      <span className="ico"><UIIcon name="Calendar" size={16} /></span>
                      <strong>Building your baseline</strong>
                    </div>
                    <p className="cycle-body">{cyclePrediction.reason}</p>
                  </>
                ) : (
                  <>
                    <div className="cycle-head">
                      <span className="ico"><UIIcon name="Calendar" size={16} /></span>
                      <strong>
                        {cyclePrediction.daysUntil < 0
                          ? "Overdue window"
                          : cyclePrediction.daysUntil === 0
                          ? "Likely today"
                          : `In about ${cyclePrediction.daysUntil} day${cyclePrediction.daysUntil === 1 ? "" : "s"}`}
                      </strong>
                    </div>
                    <p className="cycle-window">
                      {new Date(cyclePrediction.windowStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" – "}
                      {new Date(cyclePrediction.windowEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                    <p className="cycle-meta">
                      Based on {cyclePrediction.cyclesLogged} cycles · avg length {cyclePrediction.cycleLengthMean} days
                      {cyclePrediction.cycleLengthStddev > 0 && <> · ± {cyclePrediction.cycleLengthStddev}</>}
                    </p>
                  </>
                )}
              </section>
            </>
          )}

          {/* Active experiments (Premium) — shows running experiments with
              live progress + comparison snapshot. Browser sheet for adding
              new ones is below. */}
          {(activeExperiments.length > 0 || completedExperiments.length > 0) && (
            <>
              <div className="today-section-label">
                <span>Experiments</span>
                <button
                  type="button"
                  className="hint hint-btn"
                  onClick={() => isPremium ? setExperimentBrowserOpen(true) : onShowPaywall("experiment_browser")}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", color: "var(--clay-dark)", fontWeight: 600 }}
                >
                  + New
                </button>
              </div>
              {activeExperiments.map((exp) => {
                const startDate = new Date(exp.startDate + "T00:00:00");
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const elapsed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
                const remaining = Math.max(0, exp.duration - elapsed);
                const pct = Math.min(100, Math.max(0, (elapsed / exp.duration) * 100));
                const comp = compareExperiment(exp, logs);
                return (
                  <article id={`exp-card-${exp.id}`} key={exp.id} className="exp-card active">
                    <div className="exp-head">
                      <span className="ico"><UIIcon name={exp.icon || "Sparkle"} size={16} /></span>
                      <div className="ttl">
                        <strong>{exp.name}</strong>
                        <small>Day {Math.min(elapsed + 1, exp.duration)} of {exp.duration} · {remaining > 0 ? `${remaining} day${remaining === 1 ? "" : "s"} left` : "ready to wrap up"}</small>
                      </div>
                    </div>
                    <div className="exp-progress"><div className="fill" style={{ width: `${pct}%` }} /></div>
                    {comp.sampleOk && comp.targets.length > 0 && (
                      <div className="exp-deltas">
                        {comp.targets.slice(0, 2).map((t) => (
                          <div key={t.symptom} className="exp-delta">
                            <span className="sym">{t.symptom}</span>
                            <span className={`val${t.delta < 0 ? " good" : t.delta > 0 ? " bad" : ""}`}>
                              {t.delta < 0 ? "↓ " : t.delta > 0 ? "↑ " : "- "}
                              {t.summary}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {remaining === 0 && (
                      <div className="exp-actions">
                        <button type="button" className="exp-btn primary" onClick={() => endExperiment(exp.id)}>See results</button>
                      </div>
                    )}
                    {remaining > 0 && (
                      <div className="exp-actions">
                        <button type="button" className="exp-btn secondary" onClick={() => abandonExperiment(exp.id)}>Stop</button>
                      </div>
                    )}
                  </article>
                );
              })}
              {completedExperiments.slice(-2).reverse().map((exp) => {
                const comp = compareExperiment(exp, logs);
                return (
                  <article key={exp.id} className="exp-card completed">
                    <div className="exp-head">
                      <span className="ico"><UIIcon name={exp.icon || "Sparkle"} size={16} /></span>
                      <div className="ttl">
                        <strong>{exp.name}</strong>
                        <small>Completed · {exp.duration} days</small>
                      </div>
                      <span className="exp-badge">Done</span>
                    </div>
                    {comp.targets.length > 0 && (
                      <div className="exp-deltas">
                        {comp.targets.map((t) => (
                          <div key={t.symptom} className="exp-delta">
                            <span className="sym">{t.symptom}</span>
                            <span className={`val${t.delta < 0 ? " good" : t.delta > 0 ? " bad" : ""}`}>
                              {t.delta < 0 ? "↓ " : t.delta > 0 ? "↑ " : "- "}
                              {t.summary}
                            </span>
                          </div>
                        ))}
                        {comp.moodDelta !== null && Math.abs(comp.moodDelta) >= 0.3 && (
                          <div className="exp-delta">
                            <span className="sym">Mood</span>
                            <span className={`val${comp.moodDelta > 0 ? " good" : " bad"}`}>
                              {comp.moodDelta > 0 ? "↑ " : "↓ "}
                              {Math.abs(comp.moodDelta).toFixed(1)} pts
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </>
          )}

          {patternFindings.length > 0 && (
            <>
              <div className="today-section-label">
                <span>Patterns Vela has noticed</span>
                <span className="hint">{patternFindings.length} {patternFindings.length === 1 ? "finding" : "findings"}</span>
              </div>
              <div className="pattern-list">
                {patternFindings.map((p, i) => {
                  const dots = p.label === "strong" ? 3 : p.label === "steady" ? 2 : 1;
                  const labelText = p.label === "strong" ? "Strong signal" : p.label === "steady" ? "Steady signal" : "Early signal";
                  const fmap = getInsightFeedback();
                  const f = fmap[p.feedbackKey] || {};
                  // Cross-screen action: if this finding maps to a known
                  // experiment AND the user isn't already running it,
                  // surface a one-tap "Run as experiment" button so they
                  // can act on the insight without leaving the screen.
                  const expMatch = matchExperimentForInsight(p.raw);
                  const alreadyRunning = expMatch && activeExperiments.some((e) => e.libraryId === expMatch.id);
                  const recentlyCompleted = expMatch && completedExperiments.some((e) =>
                    e.libraryId === expMatch.id &&
                    e.endedAt &&
                    Date.now() - new Date(e.endedAt).getTime() < 30 * 24 * 60 * 60 * 1000
                  );
                  const showExpAction = expMatch && !alreadyRunning && !recentlyCompleted;
                  return (
                    <article className="pattern-card" key={i}>
                      <div className="ico"><UIIcon name={p.icon} size={16} /></div>
                      <div className="body">
                        <div className="head">{p.text}</div>
                        <div className="conf">
                          <span className="conf-dots">
                            <span className={dots >= 1 ? "on" : ""} />
                            <span className={dots >= 2 ? "on" : ""} />
                            <span className={dots >= 3 ? "on" : ""} />
                          </span>
                          <span>
                            {labelText}
                            {p.lag > 0 && <> · {p.lag}-day lag</>}
                            {" · "}{p.basis}
                          </span>
                        </div>
                        {showExpAction && (
                          <button
                            type="button"
                            className={`pattern-exp-btn${!isPremium ? " locked" : ""}`}
                            onClick={() => isPremium ? startExperiment(expMatch) : onShowPaywall("pattern_experiment")}
                          >
                            {!isPremium && <UIIcon name="Star" size={10} weight="fill" />}
                            Try the {expMatch.duration}-day {expMatch.name.toLowerCase()}
                            <UIIcon name="ArrowRight" size={11} />
                          </button>
                        )}
                        {alreadyRunning && (
                          <span className="pattern-exp-running">Already running this experiment</span>
                        )}
                        <div className="pattern-feedback">
                          <span className="ask">Useful?</span>
                          <button
                            type="button"
                            className={`fb-btn${f.up ? " on" : ""}`}
                            aria-label="Thumbs up"
                            onClick={(e) => { e.stopPropagation(); onPatternFeedback(p, "up"); }}
                          >
                            <UIIcon name="Heart" size={11} weight={f.up ? "fill" : "duotone"} />
                          </button>
                          <button
                            type="button"
                            className={`fb-btn${f.down ? " on down" : ""}`}
                            aria-label="Thumbs down"
                            onClick={(e) => { e.stopPropagation(); onPatternFeedback(p, "down"); }}
                          >
                            <UIIcon name="ArrowUp" size={11} style={{ transform: "rotate(180deg)" }} />
                          </button>
                          {f.up > 0 && <span className="fb-thanks">Got it. More like this.</span>}
                          {f.down > 0 && f.down < 3 && <span className="fb-thanks">Noted.</span>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {/* Anomalies — surface "this is unusual for you" findings.
              Premium-gated; free users see a teaser. */}
          {anomalies.length > 0 && (
            <>
              <div className="today-section-label">
                <span>This week vs your usual</span>
                {!isPremium && <span className="hint" style={{ color: "var(--gold)" }}>Premium</span>}
              </div>
              <div className="anomaly-list">
                {(isPremium ? anomalies : anomalies.slice(0, 1)).map((a, i) => (
                  <article key={i} className={`anomaly-card${!isPremium ? " locked" : ""}`}>
                    <div className="ico"><UIIcon name={a.icon} size={14} /></div>
                    <div className="body">
                      {!isPremium ? (
                        <>
                          <div className="head" style={{ filter: "blur(4px)", userSelect: "none" }}>{a.text}</div>
                          <button type="button" className="anomaly-unlock" onClick={() => onShowPaywall("anomaly")}>
                            <UIIcon name="Star" size={11} weight="fill" /> Unlock anomaly insights
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="head">{a.text}</div>
                          <button
                            type="button"
                            className="anomaly-ask"
                            onClick={() => {
                              const q = anomalyToQuestion(a);
                              setChatInput(q);
                              setAskOpen(true);
                              setTimeout(() => { handleQuestion(q); }, 600);
                              haptic("Light");
                            }}
                          >
                            <UIIcon name="ChatCircle" size={11} /> Ask Vela why
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {/* Personalized experiment suggestions — Premium. Maps the
              patterns above to one-tap experiments tied to what we've
              actually seen in the user's data, with the reason
              surfaced as the headline so it's never random. */}
          {experimentSuggestions.length > 0 && (
            <>
              <div className="today-section-label">
                <span>Vela suggests</span>
                <span className="hint">{!isPremium ? <span style={{ color: "var(--gold)" }}>Premium</span> : "Based on your data"}</span>
              </div>
              <div className="suggest-list">
                {experimentSuggestions.map((sug) => (
                  <article key={sug.library.id} className="suggest-card">
                    <div className="suggest-head">
                      <span className="ico"><UIIcon name={sug.library.icon} size={16} /></span>
                      <p className="reason">{sug.reason}</p>
                    </div>
                    <div className="suggest-body">
                      <strong>{sug.library.name}</strong>
                      <small>{sug.library.duration} days · watching {sug.library.targets.join(" · ")}</small>
                    </div>
                    <button
                      type="button"
                      className={`suggest-cta${isPremium ? "" : " locked"}`}
                      onClick={() => isPremium ? startExperiment(sug.library) : onShowPaywall("experiment_suggestion")}
                    >
                      {isPremium ? "Start" : <><UIIcon name="Star" size={11} weight="fill" /> Unlock</>}
                      <UIIcon name="ArrowRight" size={12} />
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}

          {uniqueDays < 21 && (
            <div className="weak-banner">
              <UIIcon name="Calendar" size={14} />
              Most patterns become reliable around week three. Keep logging.
            </div>
          )}

          <div className="today-section-label"><span>For your provider</span></div>
          <button
            type="button"
            className="export-cta"
            onClick={() => {
              if (!isPremium) { onShowPaywall("doctor_report"); return; }
              generateDoctorReport(logs, profile);
              track("doctor_report_exported", { source: "insights", uniqueDays });
            }}
          >
            <div className="ico"><UIIcon name="FileText" size={20} /></div>
            <div className="body">
              <h4>Doctor-ready summary</h4>
              <p>{uniqueDays} {uniqueDays === 1 ? "day" : "days"} · printable PDF · stays on your device</p>
            </div>
            <div className="arrow"><UIIcon name="ArrowRight" size={16} /></div>
          </button>

          {/* Experiments entry — only show "Try one" CTA if no active
              experiments and no completed history yet (otherwise the
              section above already exposes "+ New") */}
          {activeExperiments.length === 0 && completedExperiments.length === 0 && (
            <>
              <div className="today-section-label">
                <span>Try an experiment</span>
                <span className="hint">{isPremium ? "From your patterns" : <span style={{ color: "var(--gold)" }}>Premium</span>}</span>
              </div>
              <button
                type="button"
                className="exp-promo"
                onClick={() => isPremium ? setExperimentBrowserOpen(true) : onShowPaywall("experiment_browser")}
              >
                <div className="ico"><UIIcon name="Flask" size={18} /></div>
                <div className="body">
                  <h4>Run a small experiment</h4>
                  <p>Pick one change for 7-14 days. Vela compares the symptom days against the week before. No guessing.</p>
                </div>
                <div className="arrow"><UIIcon name="ArrowRight" size={16} /></div>
              </button>
            </>
          )}
        </>
      )}

      <div className="privacy-footer">
        <UIIcon name="Lock" size={12} />
        <span>Patterns are computed on this device.</span>
      </div>

      {/* Ask Vela floating button — hidden on locked state, also
          temporarily hidden when the user is actively scrolling down
          (shy-mode) so it stops covering content the user is reading. */}
      {!isLocked && (
        <button
          type="button"
          className={`ask-vela-fab${!isPremium ? " locked" : ""}${fabHidden ? " hidden" : ""}`}
          onClick={() => {
            if (!isPremium) { onShowPaywall("ask_vela_fab"); return; }
            setAskOpen(true);
            haptic("Light");
          }}
        >
          <span className="av">V</span>
          <span className="lbl">
            Ask Vela
            <span className="sub">{!isPremium ? "Premium" : "Try a question"}</span>
          </span>
        </button>
      )}

      {/* Ask Vela glass sheet (only opens for premium users) */}
      <div className={`av-scrim${askOpen ? " show" : ""}`} onClick={() => setAskOpen(false)} />
      <aside className={`av-sheet${askOpen ? " show" : ""}`} role="dialog" aria-modal="true" aria-label="Ask Vela">
        <div className="av-handle" />
        <div className="av-head">
          <div className="av-avatar">V</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="av-name">Ask Vela</div>
            <div className="av-sub">
              <UIIcon name="Lock" size={10} /> Anonymized · grounded in your data
              {monthlyAsked > 0 && (
                <> · <strong>{Math.max(0, ASK_VELA_MONTHLY_CAP - monthlyAsked)}</strong> of {ASK_VELA_MONTHLY_CAP} this month, or 30/day</>
              )}
              {remainingToday != null && remainingToday <= 5 && (
                <> · {remainingToday} left today</>
              )}
            </div>
          </div>
        </div>
        {chatMessages.length === 0 ? (
          <div className="av-q-list">
            {suggestedQs.map((q, i) => (
              <button
                key={i}
                type="button"
                className="av-q"
                onClick={() => {
                  // Plain-text version of the question for the chat
                  const plain = ["What triggers my hot flashes?", "How does sleep shape my mood?", "Are my symptoms tied to my cycle?", "What's changed since I started tracking?", "Best questions to bring to my doctor?"][i];
                  handleQuestion(plain);
                }}
              >
                <span>{q.text}</span>
                <span className="arr"><UIIcon name="ArrowRight" size={14} /></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="av-q-list">
            {chatMessages.slice(-10).map((m, i) => {
              if (m.crisis) {
                return (
                  <div key={i} style={{ alignSelf: "stretch" }}>
                    <CrisisSupportCard context="ask-vela" />
                  </div>
                );
              }
              return (
                <div key={i} style={{
                  background: m.role === "user" ? "var(--clay-light)" : "rgba(255,255,255,0.55)",
                  border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px",
                  fontSize: 13, color: "var(--ink)", lineHeight: 1.45,
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                }}>{m.text}</div>
              );
            })}
            {isTyping && <div style={{ fontSize: 12, color: "var(--ink-light)", padding: "4px 14px" }}>Vela is thinking…</div>}
          </div>
        )}
        <div className="av-input">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleQuestion(chatInput); }}
            placeholder="Ask anything about your patterns…"
          />
          <button type="button" aria-label="Send" onClick={() => handleQuestion(chatInput)}>
            <UIIcon name="ArrowRight" size={16} />
          </button>
        </div>
      </aside>

      {/* Experiment browser sheet */}
      <div className={`av-scrim${experimentBrowserOpen ? " show" : ""}`} onClick={() => setExperimentBrowserOpen(false)} />
      <aside className={`av-sheet${experimentBrowserOpen ? " show" : ""}`} role="dialog" aria-modal="true" aria-label="Choose an experiment" style={{ maxHeight: "82vh" }}>
        <div className="av-handle" />
        <div className="av-head" style={{ marginBottom: 8 }}>
          <div className="av-avatar" style={{ background: "var(--sage)" }}><UIIcon name="Flask" size={18} /></div>
          <div>
            <div className="av-name">Pick an experiment</div>
            <div className="av-sub">One change at a time. Vela does the comparison for you.</div>
          </div>
        </div>
        <div className="exp-library">
          {EXPERIMENT_LIBRARY.map((lib) => {
            const alreadyActive = activeExperiments.some((e) => e.libraryId === lib.id);
            return (
              <button
                key={lib.id}
                type="button"
                className="exp-lib-card"
                disabled={alreadyActive}
                onClick={() => startExperiment(lib)}
              >
                <div className="exp-lib-head">
                  <span className="ico"><UIIcon name={lib.icon} size={16} /></span>
                  <strong>{lib.name}</strong>
                  <span className="dur">{lib.duration} days</span>
                </div>
                <p className="exp-lib-desc">{lib.desc}</p>
                <div className="exp-lib-targets">
                  Watching: {lib.targets.join(" · ")}
                </div>
                {alreadyActive && <span className="exp-lib-status">Already running</span>}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Weekly summary sheet */}
      <div className={`av-scrim${weekSheetOpen ? " show" : ""}`} onClick={() => setWeekSheetOpen(false)} />
      <aside className={`av-sheet${weekSheetOpen ? " show" : ""}`} role="dialog" aria-modal="true" aria-label="Your week" style={{ maxHeight: "85vh" }}>
        <div className="av-handle" />
        {weeklySummary && (
          <div className="ws-sheet-body">
            <div className="ws-sheet-head">
              <span className="eye"><UIIcon name="Sparkle" size={11} /> Your week</span>
              <h2>
                {new Date(weeklySummary.windowStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" – "}
                {new Date(weeklySummary.windowEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </h2>
              <p className="ws-sheet-summary">{weeklySummary.summary}</p>
            </div>

            <div className="ws-stat-row">
              <div className="ws-stat">
                <div className="v">{weeklySummary.daysLogged}<small>/7</small></div>
                <div className="l">Days logged</div>
              </div>
              {weeklySummary.mood && (
                <div className="ws-stat">
                  <div className="v" style={{ color: "var(--clay)", display: "inline-flex", justifyContent: "center" }}>
                    <MoodFace kind={["rough", "low", "okay", "good", "great"][Math.round(weeklySummary.mood.avg)]} size={28} />
                  </div>
                  <div className="l">Avg mood{weeklySummary.mood.delta != null && Math.abs(weeklySummary.mood.delta) >= 0.4 && (
                    <span className={`delta ${weeklySummary.mood.delta > 0 ? "up" : "down"}`}>
                      {weeklySummary.mood.delta > 0 ? " ↑" : " ↓"}
                    </span>
                  )}</div>
                </div>
              )}
              {weeklySummary.sleep && (
                <div className="ws-stat">
                  <div className="v">{weeklySummary.sleep.avg.toFixed(1)}<small>h</small></div>
                  <div className="l">Avg sleep{weeklySummary.sleep.delta != null && Math.abs(weeklySummary.sleep.delta) >= 0.4 && (
                    <span className={`delta ${weeklySummary.sleep.delta > 0 ? "up" : "down"}`}>
                      {weeklySummary.sleep.delta > 0 ? " ↑" : " ↓"}
                    </span>
                  )}</div>
                </div>
              )}
            </div>

            {weeklySummary.topSymptoms.length > 0 && (
              <div className="ws-section">
                <div className="ws-section-label">Top symptoms vs prior week</div>
                {weeklySummary.topSymptoms.map((s) => (
                  <div key={s.sym} className="ws-symptom-row">
                    <span className="ico"><SymptomIcon name={s.icon} size={14} /></span>
                    <span className="sym">{s.sym}</span>
                    <span className="counts">
                      {s.count} <small>(was {s.prior})</small>
                    </span>
                    <span className={`delta ${s.delta < 0 ? "good" : s.delta > 0 ? "bad" : "flat"}`}>
                      {s.delta < 0 ? `↓ ${Math.abs(s.delta)}` : s.delta > 0 ? `↑ ${s.delta}` : "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {weeklySummary.periodDays > 0 && (
              <div className="ws-pill-row">
                <UIIcon name="Drop" size={12} />
                {weeklySummary.periodDays} period day{weeklySummary.periodDays === 1 ? "" : "s"} this week
              </div>
            )}

            {weeklySummary.stress && weeklySummary.stress.delta != null && Math.abs(weeklySummary.stress.delta) >= 0.4 && (
              <div className="ws-pill-row">
                <UIIcon name="CloudLightning" size={12} />
                Stress {weeklySummary.stress.delta > 0 ? "up" : "down"} {Math.abs(weeklySummary.stress.delta).toFixed(1)} from the week before
              </div>
            )}

            <button
              type="button"
              className="ws-pdf-btn"
              onClick={() => { generateDoctorReport(logs, profile); setWeekSheetOpen(false); }}
            >
              <UIIcon name="FileText" size={14} />
              Save this week to PDF
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
