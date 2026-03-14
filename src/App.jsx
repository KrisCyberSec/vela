import { useState, useEffect } from "react";

const SYMPTOMS = [
  { icon: "🌡", name: "Hot flash" },
  { icon: "🌙", name: "Night sweats" },
  { icon: "😴", name: "Poor sleep" },
  { icon: "🧠", name: "Brain fog" },
  { icon: "💔", name: "Mood shifts" },
  { icon: "⚡", name: "Fatigue" },
  { icon: "💧", name: "Dryness" },
  { icon: "💊", name: "Headache" },
];

const QUESTIONS = [
  {
    text: "Where are you in your hormonal journey?",
    opts: [
      "Still having regular periods",
      "Periods are irregular (perimenopause)",
      "No period for 12+ months",
      "Post-surgical menopause",
    ],
  },
  {
    text: "Which symptoms bother you most right now?",
    opts: [
      "Hot flashes & night sweats",
      "Sleep problems",
      "Mood changes & anxiety",
      "Brain fog & fatigue",
    ],
  },
  {
    text: "What's your main goal with Vela?",
    opts: [
      "Understand what's happening to my body",
      "Track symptoms to show my doctor",
      "Find relief strategies",
      "Connect with others going through this",
    ],
  },
  {
    text: "How do you prefer to receive guidance?",
    opts: [
      "Daily check-ins & reminders",
      "Weekly summaries",
      "Only when I ask",
      "Let the app decide",
    ],
  },
];

const WEEK_DATA = [
  { day: "M", height: 30 },
  { day: "T", height: 55 },
  { day: "W", height: 40 },
  { day: "T", height: 70 },
  { day: "F", height: 85 },
  { day: "S", height: 45 },
  { day: "S", height: 60 },
];

const TOP_SYMPTOMS = [
  { name: "Hot flashes", days: 5, pct: 90 },
  { name: "Poor sleep", days: 4, pct: 72 },
  { name: "Fatigue", days: 3, pct: 54 },
  { name: "Mood shifts", days: 2, pct: 36 },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --clay:       #C97B5C;
    --clay-light: #F2E8E1;
    --clay-dark:  #8C4E32;
    --sage:       #7A9E87;
    --sage-light: #EAF0EC;
    --sage-dark:  #3D6B4F;
    --cream:      #FAF6F1;
    --ink:        #2C1F17;
    --ink-mid:    #6B5347;
    --ink-light:  #A89080;
    --gold:       #D4A853;
    --border:     #EDE0D8;
    --radius:     16px;
    --radius-sm:  10px;
  }

  body {
    background: #F0EAE3;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    min-height: 100vh;
    padding: 24px 0;
    font-family: 'DM Sans', sans-serif;
  }

  .app {
    background: var(--cream);
    width: 100%;
    max-width: 420px;
    min-height: 100vh;
    border-radius: 24px;
    overflow: hidden;
    position: relative;
    box-shadow: 0 8px 40px rgba(44,31,23,0.12);
  }

  /* ── NAV ── */
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 12px;
  }
  .nav-logo {
    font-family: 'DM Serif Display', serif;
    font-size: 22px;
    color: var(--clay-dark);
    letter-spacing: -0.5px;
  }
  .nav-logo em { color: var(--clay); font-style: italic; }
  .nav-tabs {
    display: flex;
    gap: 4px;
    background: white;
    border-radius: 20px;
    padding: 4px;
    border: 1px solid var(--border);
  }
  .nav-tab {
    font-size: 11px;
    font-weight: 500;
    padding: 5px 10px;
    border-radius: 16px;
    cursor: pointer;
    color: var(--ink-light);
    transition: all 0.2s;
    border: none;
    background: transparent;
    font-family: 'DM Sans', sans-serif;
  }
  .nav-tab.active { background: var(--clay); color: white; }

  /* ── SCREENS ── */
  .screen { display: none; flex-direction: column; padding-bottom: 32px; animation: fadeIn 0.3s ease; }
  .screen.active { display: flex; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

  /* ── ONBOARDING ── */
  .onboard-hero { padding: 20px 24px 0; }
  .onboard-hero h1 {
    font-family: 'DM Serif Display', serif;
    font-size: 30px;
    line-height: 1.2;
    color: var(--ink);
    margin-bottom: 8px;
  }
  .onboard-hero h1 em { font-style: italic; color: var(--clay); }
  .onboard-hero p { font-size: 14px; color: var(--ink-mid); line-height: 1.6; }

  .progress-bar { height: 3px; background: var(--border); border-radius: 2px; margin: 20px 24px 0; }
  .progress-fill { height: 100%; border-radius: 2px; background: var(--clay); transition: width 0.4s ease; }

  .q-card {
    margin: 16px 16px 0;
    background: white;
    border-radius: var(--radius);
    padding: 20px;
    border: 1px solid var(--border);
    flex: 1;
  }
  .q-step {
    font-size: 11px;
    font-weight: 500;
    color: var(--clay);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .q-text {
    font-family: 'DM Serif Display', serif;
    font-size: 20px;
    line-height: 1.3;
    color: var(--ink);
    margin-bottom: 18px;
  }
  .q-options { display: flex; flex-direction: column; gap: 8px; }
  .q-opt {
    padding: 13px 16px;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--border);
    cursor: pointer;
    font-size: 14px;
    color: var(--ink);
    transition: all 0.18s;
    background: var(--cream);
    text-align: left;
    font-family: 'DM Sans', sans-serif;
  }
  .q-opt:hover { border-color: var(--clay); background: var(--clay-light); }
  .q-opt.selected { border-color: var(--clay); background: var(--clay-light); color: var(--clay-dark); font-weight: 500; }

  .onboard-btn {
    margin: 16px 16px 0;
    padding: 15px;
    background: var(--clay);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: background 0.2s;
  }
  .onboard-btn:hover { background: var(--clay-dark); }
  .onboard-btn:disabled { background: #D4B5A8; cursor: default; }

  /* ── TRACKER ── */
  .tracker-header { padding: 16px 24px 0; }
  .tracker-header h2 { font-family: 'DM Serif Display', serif; font-size: 24px; color: var(--ink); }
  .tracker-header p { font-size: 13px; color: var(--ink-light); margin-top: 2px; }

  .wellbeing-card {
    margin: 14px 16px 0;
    background: linear-gradient(135deg, #C97B5C 0%, #A85A3A 100%);
    border-radius: var(--radius);
    padding: 18px 20px;
    color: white;
  }
  .wb-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.8;
    margin-bottom: 10px;
  }
  .wb-faces { display: flex; justify-content: space-between; }
  .wb-face {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255,255,255,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.18s;
    font-size: 22px;
    border: 2px solid transparent;
  }
  .wb-face:hover, .wb-face.selected {
    background: rgba(255,255,255,0.35);
    border-color: rgba(255,255,255,0.7);
    transform: scale(1.1);
  }

  .section-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-light);
    margin-bottom: 10px;
  }

  .symptoms-section { margin: 14px 16px 0; }
  .symptom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .symptom-tile {
    background: white;
    border-radius: var(--radius-sm);
    padding: 12px;
    border: 1.5px solid var(--border);
    cursor: pointer;
    transition: all 0.18s;
    text-align: left;
  }
  .symptom-tile:hover { border-color: var(--clay); }
  .symptom-tile.active { border-color: var(--clay); background: var(--clay-light); }
  .s-icon { font-size: 18px; margin-bottom: 4px; }
  .s-name { font-size: 13px; font-weight: 500; color: var(--ink); display: block; }
  .symptom-tile.active .s-name { color: var(--clay-dark); }
  .s-severity { display: none; gap: 4px; margin-top: 6px; }
  .symptom-tile.active .s-severity { display: flex; }
  .sev-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border);
    cursor: pointer;
    transition: background 0.15s;
  }
  .sev-dot.on { background: var(--clay); }

  .notes-area { margin: 14px 16px 0; }
  .notes-input {
    width: 100%;
    background: white;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: var(--ink);
    resize: none;
    height: 70px;
    outline: none;
    transition: border-color 0.2s;
  }
  .notes-input:focus { border-color: var(--clay); }
  .notes-input::placeholder { color: var(--ink-light); }

  .log-btn {
    margin: 14px 16px 0;
    padding: 15px;
    background: var(--sage-dark);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .log-btn:hover { background: #2D5239; }

  /* ── INSIGHTS ── */
  .insights-header { padding: 16px 24px 0; }
  .insights-header h2 { font-family: 'DM Serif Display', serif; font-size: 24px; color: var(--ink); }
  .insights-header p { font-size: 13px; color: var(--ink-light); margin-top: 2px; }

  .insight-callout {
    margin: 14px 16px 0;
    background: var(--sage-light);
    border-radius: var(--radius);
    padding: 16px 18px;
    border-left: 3px solid var(--sage);
  }
  .ic-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sage-dark);
    margin-bottom: 4px;
  }
  .ic-text { font-size: 14px; color: var(--ink); line-height: 1.5; }
  .ic-text strong { color: var(--sage-dark); }

  .trend-card {
    margin: 12px 16px 0;
    background: white;
    border-radius: var(--radius);
    padding: 18px;
    border: 1px solid var(--border);
  }
  .trend-title { font-size: 13px; font-weight: 500; color: var(--ink); margin-bottom: 14px; }
  .chart-bars { display: flex; align-items: flex-end; gap: 6px; height: 80px; }
  .bar-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    height: 100%;
    justify-content: flex-end;
  }
  .bar {
    width: 100%;
    border-radius: 4px 4px 0 0;
    background: var(--clay-light);
    border: 1px solid var(--border);
    min-height: 4px;
  }
  .bar.high { background: var(--clay); border-color: var(--clay-dark); }
  .bar-day { font-size: 10px; color: var(--ink-light); }

  .symptom-list { margin: 12px 16px 0; }
  .sym-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid #F2EBE5;
  }
  .sym-row:last-child { border-bottom: none; }
  .sym-rank {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--clay-light);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 500;
    color: var(--clay-dark);
    flex-shrink: 0;
  }
  .sym-info { flex: 1; }
  .sym-info-name { font-size: 13px; font-weight: 500; color: var(--ink); }
  .sym-info-days { font-size: 12px; color: var(--ink-light); }
  .sym-mini-bar { height: 6px; border-radius: 3px; background: var(--clay); }

  .unlock-card {
    margin: 12px 16px 0;
    background: var(--ink);
    border-radius: var(--radius);
    padding: 20px;
    color: white;
  }
  .unlock-tag {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--gold);
    margin-bottom: 8px;
  }
  .unlock-title { font-family: 'DM Serif Display', serif; font-size: 18px; margin-bottom: 6px; }
  .unlock-body { font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5; margin-bottom: 14px; }
  .unlock-btn {
    padding: 11px 20px;
    background: var(--gold);
    color: var(--ink);
    border: none;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
  }
  .unlock-btn:hover { background: #BF9440; }

  /* ── TOAST ── */
  .toast {
    position: fixed;
    bottom: 36px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: var(--sage-dark);
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    opacity: 0;
    transition: all 0.3s;
    white-space: nowrap;
    pointer-events: none;
    z-index: 100;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
`;

// ─── Onboarding Screen ────────────────────────────────────────────────────────

function OnboardingScreen({ onComplete }) {
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);

  const q = QUESTIONS[qIndex];
  const progress = ((qIndex + 1) / QUESTIONS.length) * 100;
  const isLast = qIndex === QUESTIONS.length - 1;

  function handleSelect(i) {
    setSelected(i);
    setAnswers((prev) => ({ ...prev, [qIndex]: i }));
  }

  function handleNext() {
    if (isLast) {
      onComplete(answers);
    } else {
      setQIndex((i) => i + 1);
      setSelected(answers[qIndex + 1] ?? null);
    }
  }

  return (
    <div className="screen active">
      <div className="onboard-hero">
        <h1>
          Your body,
          <br />
          <em>finally understood.</em>
        </h1>
        <p>A few quick questions to personalize your experience.</p>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="q-card">
        <div className="q-step">
          Question {qIndex + 1} of {QUESTIONS.length}
        </div>
        <div className="q-text">{q.text}</div>
        <div className="q-options">
          {q.opts.map((opt, i) => (
            <button
              key={i}
              className={`q-opt${selected === i ? " selected" : ""}`}
              onClick={() => handleSelect(i)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <button
        className="onboard-btn"
        onClick={handleNext}
        disabled={selected === null}
      >
        {isLast ? "Start my journey →" : "Continue"}
      </button>
    </div>
  );
}

// ─── Tracker Screen ───────────────────────────────────────────────────────────

function TrackerScreen({ onLog }) {
  const [mood, setMood] = useState(null);
  const [activeSymptoms, setActiveSymptoms] = useState({});
  const [severities, setSeverities] = useState({});
  const [notes, setNotes] = useState("");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  function toggleSymptom(name) {
    setActiveSymptoms((prev) => {
      const next = { ...prev };
      if (next[name]) delete next[name];
      else next[name] = true;
      return next;
    });
  }

  function setSev(symptomName, level) {
    setSeverities((prev) => ({ ...prev, [symptomName]: level }));
  }

  function handleLog() {
    onLog({ mood, symptoms: activeSymptoms, severities, notes });
    setMood(null);
    setActiveSymptoms({});
    setSeverities({});
    setNotes("");
  }

  const moods = ["😔", "😕", "😐", "🙂", "😊"];

  return (
    <div className="screen active">
      <div className="tracker-header">
        <h2>Good morning</h2>
        <p>{today}</p>
      </div>

      <div className="wellbeing-card">
        <div className="wb-label">How are you feeling overall?</div>
        <div className="wb-faces">
          {moods.map((emoji, i) => (
            <div
              key={i}
              className={`wb-face${mood === i ? " selected" : ""}`}
              onClick={() => setMood(i)}
            >
              {emoji}
            </div>
          ))}
        </div>
      </div>

      <div className="symptoms-section">
        <div className="section-label">Symptoms today</div>
        <div className="symptom-grid">
          {SYMPTOMS.map((s) => {
            const isActive = !!activeSymptoms[s.name];
            const sev = severities[s.name] || 0;
            return (
              <div
                key={s.name}
                className={`symptom-tile${isActive ? " active" : ""}`}
                onClick={() => toggleSymptom(s.name)}
              >
                <div className="s-icon">{s.icon}</div>
                <span className="s-name">{s.name}</span>
                <div className="s-severity">
                  {[1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className={`sev-dot${sev >= level ? " on" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSev(s.name, level);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="notes-area">
        <textarea
          className="notes-input"
          placeholder="Any notes or observations..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button className="log-btn" onClick={handleLog}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="10" />
        </svg>
        Log today's entry
      </button>
    </div>
  );
}

// ─── Insights Screen ──────────────────────────────────────────────────────────

function InsightsScreen({ logs }) {
  const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];

  // Get logs from the last 7 days
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentLogs = logs.filter((l) => new Date(l.date) >= weekAgo);

  // Build per-day symptom counts for the bar chart (last 7 days)
  const weekData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayLogs = recentLogs.filter(
      (l) => l.date.slice(0, 10) === dayStr
    );
    const count = dayLogs.reduce(
      (sum, l) => sum + Object.keys(l.symptoms || {}).length,
      0
    );
    weekData.push({ day: DAY_NAMES[d.getDay()], count });
  }
  const maxCount = Math.max(...weekData.map((d) => d.count), 1);

  // Compute top symptoms from recent logs
  const symptomDays = {};
  const seenDays = {};
  recentLogs.forEach((l) => {
    const dayStr = l.date.slice(0, 10);
    Object.keys(l.symptoms || {}).forEach((name) => {
      const key = `${name}_${dayStr}`;
      if (!seenDays[key]) {
        seenDays[key] = true;
        symptomDays[name] = (symptomDays[name] || 0) + 1;
      }
    });
  });
  const topSymptoms = Object.entries(symptomDays)
    .map(([name, days]) => ({ name, days, pct: Math.round((days / 7) * 100) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 4);

  // Find most common symptom for the insight callout
  const topSymptom = topSymptoms[0];

  return (
    <div className="screen active">
      <div className="insights-header">
        <h2>Your patterns</h2>
        <p>
          Last 7 days · {recentLogs.length} entr{recentLogs.length === 1 ? "y" : "ies"} logged
        </p>
      </div>

      {recentLogs.length === 0 ? (
        <div className="insight-callout">
          <div className="ic-label">Getting started</div>
          <div className="ic-text">
            Log your first entry on the <strong>Today</strong> tab to start
            seeing patterns here.
          </div>
        </div>
      ) : (
        <>
          {topSymptom && (
            <div className="insight-callout">
              <div className="ic-label">Top pattern</div>
              <div className="ic-text">
                <strong>{topSymptom.name}</strong> appeared on{" "}
                {topSymptom.days} of the last 7 days — your most frequent
                symptom this week.
              </div>
            </div>
          )}

          <div className="trend-card">
            <div className="trend-title">Symptom intensity this week</div>
            <div className="chart-bars">
              {weekData.map(({ day, count }, i) => {
                const height = Math.round((count / maxCount) * 100);
                return (
                  <div key={i} className="bar-wrap">
                    <div
                      className={`bar${height >= 70 ? " high" : ""}`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <div className="bar-day">{day}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {topSymptoms.length > 0 && (
            <div className="symptom-list">
              <div className="section-label" style={{ padding: "12px 0 2px" }}>
                Top symptoms
              </div>
              {topSymptoms.map((s, i) => (
                <div key={i} className="sym-row">
                  <div className="sym-rank">{i + 1}</div>
                  <div className="sym-info">
                    <div className="sym-info-name">{s.name}</div>
                    <div className="sym-info-days">{s.days} of 7 days</div>
                  </div>
                  <div style={{ width: 80 }}>
                    <div className="sym-mini-bar" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="unlock-card">
        <div className="unlock-tag">Premium</div>
        <div className="unlock-title">Doctor-ready report</div>
        <div className="unlock-body">
          Export your 30-day symptom trends as a PDF to share with your OB/GYN
          at your next visit.
        </div>
        <button className="unlock-btn">Unlock for $14.99/mo</button>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState("tracker");
  const [onboarded, setOnboarded] = useState(() => {
    return JSON.parse(localStorage.getItem("vela_onboarded") || "false");
  });
  const [logs, setLogs] = useState(() => {
    return JSON.parse(localStorage.getItem("vela_logs") || "[]");
  });
  const [toast, setToast] = useState(false);

  // Inject global styles
  useEffect(() => {
    const tag = document.createElement("style");
    tag.textContent = css;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  // Persist onboarded state
  useEffect(() => {
    localStorage.setItem("vela_onboarded", JSON.stringify(onboarded));
  }, [onboarded]);

  // Persist logs
  useEffect(() => {
    localStorage.setItem("vela_logs", JSON.stringify(logs));
  }, [logs]);

  function handleLog(entry) {
    const logEntry = { ...entry, date: new Date().toISOString() };
    setLogs((prev) => [logEntry, ...prev]);
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  }

  function handleOnboardComplete() {
    setOnboarded(true);
    setScreen("tracker");
  }

  const tabs = [
    { id: "onboard", label: "Journey" },
    { id: "tracker", label: "Today" },
    { id: "insights", label: "Insights" },
  ];

  return (
    <div className="app">
      {/* Nav */}
      <div className="nav">
        <div className="nav-logo">
          Ve<em>la</em>
        </div>
        <div className="nav-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`nav-tab${screen === t.id ? " active" : ""}`}
              onClick={() => setScreen(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Screens */}
      {screen === "onboard" && (
        <OnboardingScreen onComplete={handleOnboardComplete} />
      )}
      {screen === "tracker" && <TrackerScreen onLog={handleLog} />}
      {screen === "insights" && <InsightsScreen logs={logs} />}

      {/* Toast */}
      <div className={`toast${toast ? " show" : ""}`}>
        Entry logged! Keep it up. 🌿
      </div>
    </div>
  );
}
