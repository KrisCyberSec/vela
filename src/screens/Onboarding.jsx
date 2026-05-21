// Onboarding flow that walks new users through the welcome screen, four short
// stage/concern/goal/guidance questions, and a personalized summary before
// handing off to the main app. Persists mid-flow progress to localStorage so
// closing and reopening resumes where the user left off.

import { useState, useEffect } from "react";

import { UIIcon } from "../components/icons";
import { QUESTIONS } from "../lib/questions";
import { haptic } from "../lib/haptic";

// ─── Onboarding Screen ────────────────────────────────────────────────────────

export default function OnboardingScreen({ onComplete }) {
  // Restore mid-flow progress so closing/reopening doesn't reset onboarding
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem("vela_onboarding_progress") || "null"); }
    catch { return null; }
  })();
  // step = 0 (welcome) | 1..4 (questions) | 5 (summary)
  const initialStep = Math.min(saved?.qIndex ?? 0, 5);
  const initialAnswers = saved?.answers && typeof saved.answers === "object" ? saved.answers : {};

  const [step, setStep] = useState(initialStep);
  const [answers, setAnswers] = useState(initialAnswers);
  const [transitioning, setTransitioning] = useState(false);

  // Persist progress on every change so close-and-reopen resumes mid-flow
  useEffect(() => {
    try {
      localStorage.setItem("vela_onboarding_progress", JSON.stringify({ qIndex: step, answers }));
    } catch { /* private mode. Fine */ }
  }, [step, answers]);

  const total = QUESTIONS.length;

  function setAnswer(qIdx, value) { setAnswers((a) => ({ ...a, [qIdx]: value })); }
  function toggleConcernIdx(qIdx, optIdx, max) {
    setAnswers((a) => {
      const cur = Array.isArray(a[qIdx]) ? a[qIdx] : [];
      if (cur.includes(optIdx)) return { ...a, [qIdx]: cur.filter((x) => x !== optIdx) };
      if (max && cur.length >= max) return a;
      return { ...a, [qIdx]: [...cur, optIdx] };
    });
  }

  function handleStart() {
    try { localStorage.removeItem("vela_onboarding_progress"); } catch { /* ignore */ }
    onComplete(answers);
  }

  function go(nextStep) {
    if (transitioning) return;
    haptic("Light");
    setTransitioning(true);
    setTimeout(() => { setStep(nextStep); setTransitioning(false); }, 180);
  }

  // ─── Step 0: Welcome ─────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="screen active onb-app">
        <div className="onb-welcome">
          <div className="top">
            <div>
              <div className="mark">Ve<em>la</em></div>
              <div className="tag" style={{ marginTop: 18 }}>For the change, by the changing</div>
            </div>
            <h1>A quiet place for the <em>noisy years.</em></h1>
            <p className="blurb">
              Vela learns the rhythm of your body. Hot flashes, sleep, mood, the
              rest. And shows you what's actually going on. No coaching, no fixes.
              Just your data, kept private and made plain.
            </p>
            <div className="pillars">
              <div className="pillar">
                <div className="ico"><UIIcon name="Lock" size={18} /></div>
                <span>On-device</span>
              </div>
              <div className="pillar">
                <div className="ico"><UIIcon name="ChartBar" size={18} /></div>
                <span>Patterns</span>
              </div>
              <div className="pillar">
                <div className="ico"><UIIcon name="FileText" size={18} /></div>
                <span>For your MD</span>
              </div>
            </div>
          </div>
          <div className="bottom">
            <button className="onb-next" onClick={() => go(1)}>
              Begin <UIIcon name="ArrowRight" size={16} />
            </button>
            <span className="privacy">
              <UIIcon name="Lock" size={11} /> Takes about 90 seconds
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 5: Summary ─────────────────────────────────────────────────────
  if (step === 5) {
    const stageOpt = QUESTIONS[0].opts[answers[0]];
    const stageLabel = stageOpt?.label || "your stage";
    // Stage labels read like "Periods are irregular (perimenopause)" - for
    // sentence usage ("Track signals that matter for X", "X, focused on Y")
    // we prefer the parenthetical short form when present, falling back to
    // the full label so the copy stays readable.
    const stageShort = (() => {
      const m = stageLabel.match(/\(([^)]+)\)/);
      if (m) return m[1].toLowerCase();
      // Strip any trailing parenthetical or comma clause for cleanliness
      return stageLabel.toLowerCase().replace(/\s*\([^)]*\)\s*/g, "").trim();
    })();
    const concernIdxs = Array.isArray(answers[1]) ? answers[1] : [];
    const concernLabels = concernIdxs.map((i) => QUESTIONS[1].opts[i]?.label).filter(Boolean);
    const goalIdxs = Array.isArray(answers[2]) ? answers[2] : (answers[2] != null ? [answers[2]] : []);
    const primaryGoal = goalIdxs[0];
    const guidanceIdx = answers[3];

    const items = [];
    items.push({
      title: `Track signals that matter for ${stageShort}`,
      detail: concernLabels.length
        ? `Starting with ${concernLabels.slice(0, 2).join(" and ").toLowerCase()}${concernLabels.length > 2 ? ` +${concernLabels.length - 2} more` : ""}.`
        : "We'll surface the most relevant symptoms as you log.",
    });
    items.push({
      title: "Find your patterns after seven days",
      detail: "Once we have a baseline, Vela connects sleep, stress, cycle, and symptoms.",
    });
    if (primaryGoal === 1) {
      items.push({ title: "Build a doctor-ready report", detail: "Your data, summarized for a 15-minute appointment." });
    } else if (primaryGoal === 2) {
      items.push({ title: "Run small experiments", detail: "Test one change at a time. See what actually helps." });
    } else if (primaryGoal === 3) {
      items.push({ title: "Open the Circle", detail: "An anonymous prompt each day. Read, react, or just listen." });
    } else {
      items.push({ title: "Make sense of your data", detail: "Plain-language insights, never advice." });
    }
    if (guidanceIdx === 0) items.push({ title: "Two gentle nudges a day", detail: "Morning and evening. Turn them off any time." });
    else if (guidanceIdx === 1) items.push({ title: "Sunday summaries", detail: "One quiet email each week, nothing more." });
    else if (guidanceIdx === 2) items.push({ title: "No notifications", detail: "You'll come to Vela on your own time." });

    return (
      <div className="screen active onb-app">
        <div className="onb-summary">
          <div className="body">
            <div className="onb-progress" style={{ paddingTop: 0 }}>
              <button className="back invisible" aria-hidden="true">
                <UIIcon name="ArrowRight" size={14} />
              </button>
              <div className="track"><div className="fill" style={{ width: "100%" }} /></div>
              <span className="step">Done</span>
            </div>
            <h1>Here's what <em>Vela will do</em> for you.</h1>
            <p className="lede">Built from your answers. You can change any of this in Settings later.</p>

            <div className="onb-summary-card">
              <span className="eye"><UIIcon name="Sparkle" size={11} /> Your starting point</span>
              <h2>
                {stageOpt
                  ? <>{stageShort}, focused on <em>{concernLabels[0]?.toLowerCase() || "feeling like yourself"}</em></>
                  : <>Getting started</>}
              </h2>
              <p>
                {primaryGoal === 1
                  ? "We'll build toward your next appointment. Two weeks of consistent logging is usually enough for a clear story."
                  : primaryGoal === 2
                  ? "Track for seven days, then we'll suggest one small experiment based on what we see."
                  : primaryGoal === 3
                  ? "Today's prompt is waiting in the Circle. No name, no thread. Just shared moments."
                  : "Log when you can. After a week, the patterns start to surface on their own."}
              </p>
            </div>

            <div className="onb-summary-list">
              {items.map((it, i) => (
                <div key={i} className="onb-summary-row">
                  <span className="num">{i + 1}</span>
                  <div className="text">
                    <strong>{it.title}</strong>
                    <small>{it.detail}</small>
                  </div>
                </div>
              ))}
            </div>

            <div className="onb-summary-edits">
              <UIIcon name="Sparkle" size={13} />
              <span>Want to change something? <button type="button" onClick={() => go(1)} style={{ background: "none", border: "none", padding: 0, color: "var(--clay-dark)", fontWeight: 600, textDecoration: "underline", cursor: "pointer", font: "inherit" }}>Review your answers</button>.</span>
            </div>
          </div>
          <div className="onb-footer">
            <button className="onb-next" onClick={handleStart}>
              Enter Vela <UIIcon name="ArrowRight" size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Steps 1-4: Questions ────────────────────────────────────────────────
  const qIdx = step - 1;
  const q = QUESTIONS[qIdx];
  const isMulti = !!q.multi;
  const value = answers[qIdx];
  const canNext = isMulti ? Array.isArray(value) && value.length > 0 : value !== undefined && value !== null;
  const max = q.max || 5;
  const ctLabel = isMulti && Array.isArray(value)
    ? (value.length === 0 ? "Pick at least one to continue." : `${value.length} of ${max} selected`)
    : null;

  return (
    <div className="screen active onb-app">
      <div className="onb-scroll">
        <div className="onb-progress">
          <button
            className={`back${step === 1 ? " invisible" : ""}`}
            onClick={() => go(step - 1)}
            aria-label="Back"
          >
            <UIIcon name="ArrowRight" size={14} style={{ transform: "rotate(180deg)" }} />
          </button>
          <div className="track"><div className="fill" style={{ width: `${(step / total) * 100}%` }} /></div>
          <span className="step">{step} / {total}</span>
        </div>
        <div className={`onb-question ${transitioning ? "" : ""}`}>
          <span className="eyebrow"><UIIcon name="Sparkle" size={11} /> {q.eyebrow}</span>
          <h1>{q.headline}</h1>
          <p className="subhead">{q.sub}</p>

          {isMulti ? (
            <div className="onb-chip-grid">
              {q.opts.map((opt, i) => {
                const sel = Array.isArray(value) && value.includes(i);
                const idx = Array.isArray(value) ? value.indexOf(i) : -1;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`onb-chip${sel ? " selected" : ""}`}
                    onClick={() => toggleConcernIdx(qIdx, i, max)}
                  >
                    <span className="glyph"><UIIcon name={opt.icon} size={16} /></span>
                    <span className="label">{opt.label}</span>
                    {sel && <span className="pin">{idx + 1}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="onb-options">
              {q.opts.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  className={`onb-option${value === i ? " selected" : ""}`}
                  onClick={() => setAnswer(qIdx, i)}
                >
                  <span className="glyph"><UIIcon name={opt.icon} size={18} /></span>
                  <span className="body">
                    <span className="label">{opt.label}</span>
                    {opt.hint && <span className="hint">{opt.hint}</span>}
                  </span>
                  <span className="check"><UIIcon name="CheckCircle" size={12} /></span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="onb-footer">
        {ctLabel && <p className="helper">{ctLabel}</p>}
        <button
          className="onb-next"
          disabled={!canNext}
          onClick={() => go(step === total ? 5 : step + 1)}
        >
          {step === total ? "See your plan" : "Continue"} <UIIcon name="ArrowRight" size={16} />
        </button>
      </div>
    </div>
  );
}
