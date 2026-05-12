// Today (formerly Tracker) screen. The primary daily-logging surface
// where users record mood, energy, symptoms, severity, and contextual
// triggers (sleep / stress / period / caffeine / alcohol / exercise).
// It also hosts the morning "reveal" card and — for Premium users with
// at least seven days of data — the AI-generated daily brief.

import { useState, useEffect } from "react";

import { track } from "../analytics";
import { getAppUserId } from "../subscription";
import { isHealthKitEnabled, fetchYesterdaySleep } from "../healthkit";

import { CrisisSupportCard } from "../components/CrisisSupportCard";
import { SymptomIcon, UIIcon, MoodFace, EnergyGlyph, RevealChart } from "../components/icons";

import { analyzeCorrelations } from "../lib/correlations";
import { matchExperimentForInsight, renderBriefBody } from "../lib/experiments";
import { forecastTomorrow } from "../lib/forecast";
import { getAdaptiveGreeting, getJourneyLabel, getStreak, localDateStr } from "../lib/formatters";
import { haptic } from "../lib/haptic";
import { computeEarlyStats } from "../lib/patterns";
import { getPersonalization } from "../lib/personalization";
import { QUESTIONS } from "../lib/questions";
import { buildDailyBriefSummary } from "../lib/summaries";
import { MOODS, SYMPTOMS, prioritizedSymptomsForCat } from "../lib/symptoms";

export default function TodayScreen({ onLog, logs, profile, isPremium, onNavigate, onShowPaywall }) {
  const [mood, setMood] = useState(null);
  const [activeSymptoms, setActiveSymptoms] = useState({});
  const [severities, setSeverities] = useState({});
  const [notes, setNotes] = useState("");
  const personalization = getPersonalization(profile);
  const [symptomCat, setSymptomCat] = useState(personalization?.defaultSymptomCat || "common");
  const [sleepHours, setSleepHours] = useState(null);
  const [stress, setStress] = useState(null);
  const [caffeine, setCaffeine] = useState(null);
  const [alcohol, setAlcohol] = useState(null);
  const [exercise, setExercise] = useState(null);
  // customSymptoms persisted; the inline-add-modal UI is gone in the redesign
  // but existing user-defined symptoms continue to render in the grid.
  const [customSymptoms] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vela_custom_symptoms")) || []; } catch { return []; }
  });
  const [periodLogged, setPeriodLogged] = useState(null);
  const [periodFlow, setPeriodFlow] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [showCelebration, setShowCelebration] = useState(null);
  // HealthKit auto-fill — pulls yesterday's sleep when permission's been
  // granted. Sets a flag so the UI can show "Synced from Apple Health"
  // and the user can override by tapping the +/- buttons.
  const [hkSyncedSleep, setHkSyncedSleep] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isHealthKitEnabled()) return;
      const hours = await fetchYesterdaySleep();
      if (cancelled || hours == null) return;
      setSleepHours((current) => current == null ? hours : current);
      setHkSyncedSleep(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Daily brief (Premium) ──────────────────────────────────────────
  // Fetches today's brief from /api/daily-brief once per day (server
  // caches per appUserId+date so repeat opens are free). Only runs for
  // premium users with at least 7 days of data — anything earlier and
  // there's not enough signal for the brief to be worth reading.
  const [dailyBrief, setDailyBrief] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vela_daily_brief") || "null"); }
    catch { return null; }
  });
  const [briefLoading, setBriefLoading] = useState(false);
  useEffect(() => {
    if (!isPremium) return;
    const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
    if (uniqueDays < 7) return;
    const today = localDateStr(new Date());
    if (dailyBrief && dailyBrief.date === today) return; // already fetched today
    let cancelled = false;
    (async () => {
      setBriefLoading(true);
      try {
        const summary = buildDailyBriefSummary(logs);
        const stageIdx = profile?.[0];
        const concernAns = profile?.[1];
        const goalAns = profile?.[2];
        const concernIdxs = Array.isArray(concernAns) ? concernAns : (concernAns != null ? [concernAns] : []);
        const goalIdxs = Array.isArray(goalAns) ? goalAns : (goalAns != null ? [goalAns] : []);
        const profilePayload = {
          stage: stageIdx != null ? QUESTIONS[0].opts[stageIdx]?.label : null,
          concerns: concernIdxs.map((i) => QUESTIONS[1].opts[i]?.label).filter(Boolean),
          goals: goalIdxs.map((i) => QUESTIONS[2].opts[i]?.label).filter(Boolean),
          // Legacy single-goal field; daily-brief.js still reads this.
          goal: goalIdxs.length ? QUESTIONS[2].opts[goalIdxs[0]]?.label : null,
        };
        const appUserId = await getAppUserId();
        const r = await fetch("/api/daily-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary, profile: profilePayload, appUserId }),
        });
        if (!cancelled && r.ok) {
          const data = await r.json();
          const record = { brief: data.brief, date: today, generatedAt: data.generatedAt };
          setDailyBrief(record);
          try {
            localStorage.setItem("vela_daily_brief", JSON.stringify(record));
            localStorage.setItem("vela_last_brief_date", today);
          } catch { /* private mode */ }
        }
      } catch { /* network. Try again tomorrow */ }
      finally { if (!cancelled) setBriefLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, logs.length]);

  const allSymptoms = [...SYMPTOMS, ...customSymptoms];

  // Active experiments live in InsightsScreen state, persisted in
  // localStorage. We read on each render (cheap) so the brief can
  // detect mentions and turn them into deep-link taps.
  const activeExperimentsForBrief = (() => {
    try {
      const all = JSON.parse(localStorage.getItem("vela_experiments") || "[]");
      return all.filter((e) => e.status === "active");
    } catch { return []; }
  })();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const streak = getStreak(logs);
  const journeyStage = profile ? getJourneyLabel(profile[0]) : null;

  function toggleSymptom(name) {
    setActiveSymptoms((prev) => {
      const next = { ...prev };
      if (next[name]) delete next[name];
      else next[name] = true;
      return next;
    });
  }

  const canLog = mood !== null || Object.keys(activeSymptoms).length > 0;

  function handleLog() {
    if (!canLog) return;
    haptic("Medium");

    // Capture celebration data before clearing state
    const entrySymptoms = Object.keys(activeSymptoms);
    const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size + (logs.some((l) => l.date.slice(0, 10) === localDateStr(new Date())) ? 0 : 1);
    const currentStreak = getStreak(logs);
    const stats = computeEarlyStats(logs);
    const daysLeft = Math.max(0, 7 - uniqueDays);
    const p = getPersonalization(profile);
    const concern = p?.topConcernNames?.[0];

    let celebTitle = "Entry logged!";
    let celebText = "";
    let celebIcon = "✓";

    if (uniqueDays === 1) {
      celebTitle = "Your journey begins!";
      celebText = "6 more days until your first pattern report.";
      celebIcon = "🌱";
    } else if (uniqueDays === 2) {
      celebTitle = "Day 2. Building your baseline";
      celebText = concern
        ? `Vela is now watching your ${concern} patterns. 5 more days to insights.`
        : "Building your baseline. 5 more days to insights.";
      celebIcon = "📊";
    } else if (uniqueDays === 3) {
      celebTitle = "Early patterns forming";
      celebText = stats?.topSymptom
        ? `Your most logged symptom so far: ${stats.topSymptom[0]}. 4 more days for deeper analysis.`
        : "Your data is starting to tell a story. 4 more days to go.";
      celebIcon = "🔍";
    } else if (uniqueDays >= 4 && uniqueDays < 7) {
      celebTitle = `${daysLeft} day${daysLeft !== 1 ? "s" : ""} to insights`;
      celebText = concern
        ? `Almost there! Vela will reveal what triggers your ${concern}.`
        : "Almost there! Your personalized patterns are taking shape.";
      celebIcon = "🌟";
    } else if (uniqueDays === 7) {
      celebTitle = "Insights unlocked!";
      celebText = "Your first week is complete. Head to Insights to see your patterns.";
      celebIcon = "✨";
    } else {
      // Streak milestone celebrations
      if (currentStreak === 30) {
        celebTitle = "30-day streak!";
        celebText = "A full month of tracking. You now have powerful data about your body's patterns. This is the kind of consistency that changes how you manage your health.";
        celebIcon = "👑";
      } else if (currentStreak === 21) {
        celebTitle = "21-day streak!";
        celebText = "Three weeks strong. Research shows it takes 21 days to form a habit. Tracking is now part of your routine.";
        celebIcon = "🏆";
      } else if (currentStreak === 14) {
        celebTitle = "14-day streak!";
        celebText = "Two solid weeks! Vela can now compare week-over-week trends and spot patterns that shorter tracking misses.";
        celebIcon = "⭐";
      } else if (currentStreak >= 3) {
        celebTitle = `${currentStreak}-day streak!`;
        celebIcon = "🔥";
      }
      if (![14, 21, 30].includes(currentStreak)) {
        celebText = entrySymptoms.length > 0
          ? `Logged ${entrySymptoms.length} symptom${entrySymptoms.length !== 1 ? "s" : ""}. Your pattern clarity keeps improving.`
          : "Every entry sharpens your insights.";
      }
    }

    setShowCelebration({
      title: celebTitle,
      text: celebText,
      icon: celebIcon,
      streak: currentStreak,
      uniqueDays,
      symptomCount: entrySymptoms.length,
      moodEmoji: mood !== null ? MOODS[mood] : null,
    });

    onLog({ mood, energy, symptoms: activeSymptoms, severities, notes, context: { sleepHours, stress, caffeine, alcohol, exercise, period: periodLogged, periodFlow } });
    setMood(null);
    setEnergy(null);
    setActiveSymptoms({});
    setSeverities({});
    setNotes("");
    setSleepHours(null);
    setStress(null);
    setCaffeine(null);
    setAlcohol(null);
    setExercise(null);
    setPeriodLogged(null);
    setPeriodFlow(null);

    setTimeout(() => setShowCelebration(null), 4500);
  }

  // ─── Reveal card content derived from real user data state ─────────────────
  const uniqueDays = new Set(logs.map((l) => l.date.slice(0, 10))).size;
  const dataState = uniqueDays === 0 ? "empty" : uniqueDays < 7 ? "building" : "rich";

  // Already-logged-today derivation. After save the form clears, so the
  // "Tap a mood or symptom" copy reappears and the user has no idea their
  // entry stuck. We compute the latest log for today and surface a
  // confirmation chip right above the save bar so they know.
  const todayKey = localDateStr(new Date());
  const todaysLogs = logs.filter((l) => l.date.slice(0, 10) === todayKey);
  const latestToday = todaysLogs.length > 0
    ? todaysLogs.reduce((a, b) => (a.date > b.date ? a : b))
    : null;
  const loggedToday = !!latestToday;
  const todaySymptomCount = (() => {
    const set = new Set();
    todaysLogs.forEach((l) => Object.keys(l.symptoms || {}).forEach((s) => set.add(s)));
    return set.size;
  })();
  const todayLastTime = latestToday
    ? new Date(latestToday.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "")
    : null;
  const correlations = dataState === "rich" ? analyzeCorrelations(logs) : [];
  const topCorr = correlations[0];
  const reveal = (() => {
    if (dataState === "empty") {
      return {
        eyebrow: "Day 1 · Welcome",
        headline: <>This is where your <em>patterns</em> will live.</>,
        body: "Log today below. Even a quick mood check counts. After seven days, Vela starts surfacing the rhythms in your symptoms.",
        chartType: "none",
        foot: "Up to 80% of women experience hot flashes during the menopausal transition.",
        link: null,
      };
    }
    if (dataState === "building") {
      const left = 7 - uniqueDays;
      return {
        eyebrow: `Day ${uniqueDays} · Building your baseline`,
        headline: <>Patterns will emerge in <em>{left} more day{left !== 1 ? "s" : ""}.</em></>,
        body: "Keep logging daily. Even a quick mood check counts. Your first weekly pattern report unlocks at seven days.",
        chartType: "build",
        foot: `${uniqueDays} of 7 days logged so far.`,
        link: null,
      };
    }
    // rich
    if (topCorr) {
      return {
        eyebrow: "Yesterday's pattern",
        headline: <>{topCorr.text}</>,
        body: "A consistent signal worth showing your provider. Tap below to see the full pattern report.",
        chartType: "rich",
        foot: `${uniqueDays} days tracked · ${logs.length} entries`,
        link: "Open Insights",
      };
    }
    return {
      eyebrow: "Your baseline",
      headline: <>{uniqueDays} days of data, <em>still listening.</em></>,
      body: "Vela is watching for cross-symptom triggers. Stronger patterns appear with more consistent logging.",
      chartType: "rich",
      foot: `${uniqueDays} days tracked · ${logs.length} entries`,
      link: "Open Insights",
    };
  })();

  // Mood face mapping (data 0-4 → expressive face)
  const MOOD_FACES = ["rough", "low", "okay", "good", "great"];
  const MOOD_LABELS = ["Rough", "Low", "Okay", "Good", "Great"];

  // Energy labels (data 1-5 → 5 ascending tiles)
  const ENERGY_LABELS = ["Depleted", "Low", "Steady", "Good", "Bright"];

  function bumpSev(name, e) {
    e.stopPropagation();
    if (!activeSymptoms[name]) {
      setActiveSymptoms({ ...activeSymptoms, [name]: true });
      setSeverities({ ...severities, [name]: 1 });
      return;
    }
    const cur = severities[name] || 1;
    const next = cur >= 3 ? 1 : cur + 1;
    setSeverities({ ...severities, [name]: next });
  }

  const symptomCount = Object.keys(activeSymptoms).length;
  const symptomCats = [
    { key: "common", label: "Most common" },
    { key: "mood", label: "Mood" },
    { key: "physical", label: "Physical" },
    { key: "intimate", label: "Intimate" },
    { key: "digestive", label: "Digestive" },
    { key: "other", label: "Other" },
  ];
  const symptomsForCat = prioritizedSymptomsForCat(allSymptoms, symptomCat, personalization?.concerns);

  const summary = (() => {
    const parts = [];
    if (mood !== null) parts.push(MOOD_LABELS[mood]);
    if (symptomCount > 0) parts.push(`${symptomCount} symptom${symptomCount !== 1 ? "s" : ""}`);
    if (energy !== null) parts.push(`${ENERGY_LABELS[energy - 1]?.toLowerCase()} energy`);
    if (sleepHours !== null) parts.push(`${sleepHours}h sleep`);
    return parts;
  })();

  return (
    <div className="screen active vela-app">
      {/* Sticky glass header */}
      <header className="vela-header">
        <div className="vela-header-row">
          <span className="vela-wordmark">Ve<em>la</em></span>
          {streak > 0 && (
            <span className="vela-header-streak">
              <UIIcon name="Sparkle" size={12} /> {streak}-day streak
            </span>
          )}
        </div>
      </header>

      {/* Greeting */}
      <section className="vela-greeting">
        <h1>{getAdaptiveGreeting(logs)}.</h1>
        <p className="meta">{today}{journeyStage ? <> <span className="dot">·</span> {journeyStage}</> : null}</p>
      </section>

      {/* CRISIS PRECONDITION — if the user has logged sustained low
          mood (avg ≤ 1 over the last 5 days with ≥ 3 entries), suppress
          the cheerful AI brief and surface the support card instead.
          This is the highest-priority "do no harm" check on Today. */}
      {(() => {
        const fiveAgo = new Date(); fiveAgo.setHours(0,0,0,0); fiveAgo.setDate(fiveAgo.getDate() - 5);
        const recentMood = logs
          .filter((l) => { const d = new Date(l.date); d.setHours(0,0,0,0); return d >= fiveAgo; })
          .filter((l) => l.mood !== null && l.mood !== undefined);
        const avgMood = recentMood.length >= 3
          ? recentMood.reduce((s, l) => s + l.mood, 0) / recentMood.length
          : null;
        if (avgMood !== null && avgMood <= 1) {
          return <CrisisSupportCard context="today-mood-crash" />;
        }
        return null;
      })()}

      {/* Daily AI brief (Premium) — when present, replaces the static
          reveal card. This is the proactive Vela voice: a fresh 2-3
          sentence read on yesterday + the past week, generated each
          morning by Claude grounded in anonymized data. */}
      {dailyBrief?.brief && isPremium ? (
        <section className="brief-card">
          <div className="brief-eyebrow">
            <UIIcon name="Sparkle" size={11} weight="fill" /> Vela today
          </div>
          <p className="brief-body">{renderBriefBody(dailyBrief.brief, activeExperimentsForBrief, onNavigate)}</p>
          <div className="brief-foot">
            <span>Refreshes each morning</span>
            <span className="brief-link" onClick={() => onNavigate && onNavigate("insights")}>
              See patterns <UIIcon name="ArrowRight" size={12} />
            </span>
          </div>
        </section>
      ) : (
        /* Reveal card. Content morphs by data state */
        <section
          className="reveal-card-v2"
          onClick={reveal.link ? () => onNavigate && onNavigate("insights") : undefined}
          style={reveal.link ? { cursor: "pointer" } : undefined}
        >
          <div className="reveal-eyebrow">
            <UIIcon name="Sparkle" size={11} /> {reveal.eyebrow}
          </div>
          <h2 className="reveal-headline-v2">{reveal.headline}</h2>
          <p className="reveal-body-v2">{reveal.body}</p>
          <RevealChart kind={reveal.chartType} logs={logs} />
          <div className="reveal-foot">
            <span>{reveal.foot}</span>
            {reveal.link && (
              <span className="reveal-link">
                {reveal.link} <UIIcon name="ArrowRight" size={12} />
              </span>
            )}
          </div>
          {briefLoading && (
            <p style={{ fontSize: 11, color: "var(--ink-light)", margin: "8px 0 0", letterSpacing: 0.04, textTransform: "uppercase" }}>
              Vela is reading your week…
            </p>
          )}
        </section>
      )}

      {/* Forecast — Premium. Bayesian-flavored "what tomorrow may
          look like" based on cycle phase + recency + recent triggers.
          Quietly hides if confidence is too low or data is too thin. */}
      {(() => {
        const forecast = forecastTomorrow(logs);
        if (!forecast || forecast.predictions.length === 0) return null;
        return (
          <>
            <div className="today-section-label">
              <span>What tomorrow may bring</span>
              {!isPremium && <span className="hint" style={{ color: "var(--gold)" }}>Premium</span>}
            </div>
            <section className={`forecast-card${!isPremium ? " locked" : ""}`}>
              {!isPremium ? (
                <>
                  <p className="forecast-teaser">
                    Vela can read your cycle phase, recent triggers, and the past two days of symptoms to give you a heads-up on tomorrow.
                  </p>
                  <button type="button" className="forecast-unlock" onClick={() => onShowPaywall("forecast")}>
                    <UIIcon name="Star" size={11} weight="fill" /> Unlock with Premium
                  </button>
                </>
              ) : (
                <>
                  {forecast.inCycleWindow && (
                    <div className="forecast-eyebrow">
                      <UIIcon name="Calendar" size={11} /> In your usual cycle window
                    </div>
                  )}
                  <ul className="forecast-list">
                    {forecast.predictions.map((p) => (
                      <li key={p.symptom}>
                        <span className="prob">{Math.round(p.prob * 100)}%</span>
                        <span className="sym">{p.symptom}</span>
                        {p.why.length > 0 && <span className="why">· {p.why[0]}</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="forecast-foot">A read, not a prediction. Your data, this morning.</p>
                </>
              )}
            </section>
          </>
        );
      })()}

      {/* Mood */}
      <div className="today-section-label">
        <span>How are you, today?</span>
        {mood !== null && <span className="hint">{MOOD_LABELS[mood]}</span>}
      </div>
      <div className="mood-row">
        {MOOD_FACES.map((face, i) => (
          <button
            key={face}
            type="button"
            className={`mood-tile${mood === i ? " active" : ""}`}
            onClick={() => { haptic("Light"); setMood(mood === i ? null : i); }}
            aria-label={MOOD_LABELS[i]}
            aria-pressed={mood === i}
          >
            <MoodFace kind={face} size={30} />
            {mood === i && <span className="label">{MOOD_LABELS[i]}</span>}
          </button>
        ))}
      </div>

      {/* Energy */}
      <div className="today-section-label"><span>Energy</span></div>
      <div className="energy-row-v2">
        {ENERGY_LABELS.map((label, i) => {
          const level = i + 1;
          return (
            <button
              key={label}
              type="button"
              className={`energy-tile${energy === level ? " active" : ""}`}
              onClick={() => { haptic("Light"); setEnergy(energy === level ? null : level); }}
              aria-pressed={energy === level}
            >
              <EnergyGlyph level={level} size={30} />
              <span className="label">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Symptoms */}
      <div className="today-section-label">
        <span>Symptoms</span>
        {symptomCount > 0 && <span className="hint">{symptomCount} logged · tap dots for severity</span>}
      </div>
      <div className="seg" role="tablist">
        {symptomCats.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={symptomCat === c.key}
            className={symptomCat === c.key ? "active" : ""}
            onClick={() => { haptic("Light"); setSymptomCat(c.key); }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="symptom-grid-v2">
        {symptomsForCat.map((s) => {
          const isActive = !!activeSymptoms[s.name];
          const sev = severities[s.name] || 0;
          return (
            <button
              key={s.cat + s.name}
              type="button"
              className={`symptom-tile-v2${isActive ? " active" : ""}`}
              onClick={() => { haptic("Light"); toggleSymptom(s.name); }}
            >
              <SymptomIcon name={s.icon} size={26} />
              <span className="name">{s.name}</span>
              <div className="severity-strip" onClick={(e) => bumpSev(s.name, e)} aria-label="Tap to set severity">
                <span className={`sev-dot${sev >= 1 ? " on" : ""}`} />
                <span className={`sev-dot${sev >= 2 ? " on" : ""}`} />
                <span className={`sev-dot${sev >= 3 ? " on" : ""}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Context */}
      <div className="today-section-label"><span>Context</span><span className="hint">Optional</span></div>
      <div className="context-grid">
        {/* Sleep. Stepper. Auto-fills from Apple Health when enabled. */}
        <div className="context-card">
          <div className="label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><UIIcon name="Bed" size={13} /> Sleep</span>
            {hkSyncedSleep && (
              <span className="hk-pill" title="Pulled from Apple Health. Tap +/− to override">
                <UIIcon name="Heart" size={10} weight="fill" /> Health
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span className="value">
              {sleepHours !== null ? sleepHours : "-"}
              {sleepHours !== null && <span className="unit">hrs</span>}
            </span>
            <div className="context-stepper">
              <button type="button" onClick={() => { setSleepHours(Math.max(0, (sleepHours ?? 7) - 0.5)); setHkSyncedSleep(false); }} aria-label="Decrease sleep">−</button>
              <button type="button" onClick={() => { setSleepHours(Math.min(14, (sleepHours ?? 6.5) + 0.5)); setHkSyncedSleep(false); }} aria-label="Increase sleep">+</button>
            </div>
          </div>
        </div>

        {/* Stress. 1-5 dots */}
        <div className="context-card">
          <div className="label"><UIIcon name="CloudLightning" size={13} /> Stress</div>
          <div>
            <div className="value" style={{ fontSize: 16 }}>
              {stress !== null ? ["Calm", "Mild", "Moderate", "High", "Acute"][stress - 1] : "-"}
            </div>
            <div className="context-dots">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={stress === n ? "on" : ""}
                  onClick={() => { haptic("Light"); setStress(stress === n ? null : n); }}
                  aria-label={`Stress level ${n}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Period. Chips, full width */}
        <div className="context-card" style={{ gridColumn: "1 / -1" }}>
          <div className="label"><UIIcon name="Drop" size={13} /> Period today</div>
          <div className="period-chips">
            {[
              { key: "none", label: "None" },
              { key: "spotting", label: "Spotting" },
              { key: "light", label: "Light" },
              { key: "medium", label: "Medium" },
              { key: "heavy", label: "Heavy" },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={periodLogged === key ? "on" : ""}
                onClick={() => {
                  haptic("Light");
                  setPeriodLogged(periodLogged === key ? null : key);
                  setPeriodFlow(key === "none" ? null : key);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Triggers — caffeine / alcohol / exercise (full width).
            Critical for analyzeCorrelations() — kept as toggle chips. */}
        <div className="context-card" style={{ gridColumn: "1 / -1" }}>
          <div className="label"><UIIcon name="Sparkle" size={13} /> Today's triggers</div>
          <div className="period-chips">
            {[
              { key: "caffeine", label: "Caffeine", state: caffeine, setter: setCaffeine },
              { key: "alcohol", label: "Alcohol", state: alcohol, setter: setAlcohol },
              { key: "exercise", label: "Exercise", state: exercise, setter: setExercise },
            ].map(({ key, label, state, setter }) => (
              <button
                key={key}
                type="button"
                className={state === true ? "on" : ""}
                onClick={() => { haptic("Light"); setter(state === true ? null : true); }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cross-screen nudge: when the user is logging a symptom AND a
          trigger that already correlates in their history, surface a
          one-tap experiment offer right inline. Only fires when there's
          a real correlation in the data — not at random. */}
      {(() => {
        // What did the user just log this session?
        const activeSymList = Object.keys(activeSymptoms || {}).filter((s) => activeSymptoms[s]);
        const activeTriggers = [
          caffeine === true ? "caffeine" : null,
          alcohol === true ? "alcohol" : null,
          exercise === true ? "exercise" : null,
        ].filter(Boolean);
        if (activeSymList.length === 0 || activeTriggers.length === 0) return null;
        // Need correlations to know what links to what
        const corrs = analyzeCorrelations(logs);
        if (!corrs || corrs.length === 0) return null;
        // Find a correlation that matches BOTH a current symptom AND a current trigger
        const match = corrs.find((c) =>
          activeTriggers.includes(c.context) &&
          activeSymList.includes(c.symptom) &&
          c.lift >= 1.8
        );
        if (!match) return null;
        // Map to an experiment in the library
        const lib = matchExperimentForInsight(match);
        if (!lib) return null;
        // Skip if already running or recently completed
        const exps = (() => { try { return JSON.parse(localStorage.getItem("vela_experiments") || "[]"); } catch { return []; } })();
        const recentlyDealt = exps.some((e) =>
          e.libraryId === lib.id && (
            e.status === "active" ||
            (e.endedAt && Date.now() - new Date(e.endedAt).getTime() < 30 * 24 * 60 * 60 * 1000)
          )
        );
        if (recentlyDealt) return null;
        const symLow = match.symptom.toLowerCase();
        return (
          <div className="trigger-nudge">
            <div className="trigger-nudge-head">
              <UIIcon name="Sparkle" size={13} />
              <span>You logged {match.context} and {symLow}.</span>
            </div>
            <p>
              {match.context} days have correlated with {symLow} {match.lift >= 99 ? "every time" : `${match.lift.toFixed(1)}x`} in your history. Want to test removing it for {lib.duration} days?
            </p>
            <button
              type="button"
              className={`trigger-nudge-cta${!isPremium ? " locked" : ""}`}
              onClick={() => {
                if (!isPremium) { onShowPaywall("trigger_nudge"); return; }
                // Inline-start the experiment — same shape as the
                // Insights startExperiment, kept here so this Today
                // surface doesn't depend on a sibling component.
                const newExp = {
                  id: `${lib.id}_${Date.now()}`,
                  libraryId: lib.id,
                  name: lib.name,
                  desc: lib.desc,
                  icon: lib.icon,
                  duration: lib.duration,
                  targets: lib.targets,
                  startDate: localDateStr(new Date()),
                  status: "active",
                };
                try {
                  const cur = JSON.parse(localStorage.getItem("vela_experiments") || "[]");
                  localStorage.setItem("vela_experiments", JSON.stringify([...cur, newExp]));
                } catch { /* private mode */ }
                haptic("Medium");
                track("experiment_started_from_today_nudge", { libraryId: lib.id });
              }}
            >
              {!isPremium && <UIIcon name="Star" size={11} weight="fill" />}
              Start the {lib.duration}-day experiment
              <UIIcon name="ArrowRight" size={12} />
            </button>
          </div>
        );
      })()}

      {/* Notes */}
      <div className="today-section-label">
        <span>Note to yourself</span>
        <span className="hint">{notes.length}/500</span>
      </div>
      <div className="notes-card-v2">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 500))}
          placeholder="A line or two on what shaped today. A meeting, a meal, a moment that helped."
        />
      </div>

      {/* Privacy footer */}
      <div className="privacy-footer">
        <UIIcon name="Lock" size={12} />
        <span>Your data stays on this device.</span>
      </div>

      {/* Sticky glass save bar — copy adapts:
          - In progress (something in form) → live preview
          - Empty + already logged today → confirmation chip
          - Empty + nothing logged today → invitation */}
      <div className="save-bar">
        <div className="inner">
          <div className="save-summary">
            {summary.length > 0 ? (
              <><strong>Today:</strong> {summary.join(" · ")}</>
            ) : loggedToday ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <UIIcon name="CheckCircle" size={13} weight="fill" style={{ color: "var(--sage-dark)" }} />
                <span><strong>Logged today</strong> · {todayLastTime}{todaySymptomCount > 0 ? ` · ${todaySymptomCount} symptom${todaySymptomCount === 1 ? "" : "s"}` : ""} · tap to add more</span>
              </span>
            ) : (
              <em>Tap a mood or symptom to begin.</em>
            )}
          </div>
          <button
            type="button"
            className="save-btn"
            disabled={!canLog}
            onClick={handleLog}
          >
            {loggedToday && summary.length > 0 ? "Add to today" : "Save entry"}
          </button>
        </div>
      </div>


      {showCelebration && (
        <div className="post-log-celebration" onClick={() => setShowCelebration(null)}>
          <div className="celebration-card">
            <div className="celebration-icon">{showCelebration.icon}</div>
            <div className="celebration-title">{showCelebration.title}</div>
            {showCelebration.moodEmoji && (
              <div className="celebration-mood">{showCelebration.moodEmoji}</div>
            )}
            <div className="celebration-text">{showCelebration.text}</div>
            {showCelebration.streak > 1 && (
              <div className="celebration-streak">🔥 {showCelebration.streak}-day streak</div>
            )}
            {showCelebration.uniqueDays < 7 && (
              <div className="celebration-progress">
                <div className="milestone-bar-bg">
                  <div className="milestone-bar" style={{ width: `${(showCelebration.uniqueDays / 7) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Keep the old name reachable so App.jsx callers can be updated in a
// follow-up commit without breaking imports right now.
export { TodayScreen as TrackerScreen };
