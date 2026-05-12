// Premium upgrade screen. Pillar copy must match what actually ships;
// each pillar maps to a real, wired feature (Ask Vela, daily brief,
// doctor report, experiments, cycle prediction, etc.). Renders monthly
// vs annual plan toggle and calls back into the App-level subscribe /
// restore handlers via props. No localStorage of its own — the parent
// owns subscription state.

import { useState } from "react";

import { UIIcon } from "../components/icons";

export default function PaywallScreen({ onClose, onSubscribe, onRestore }) {
  const [plan, setPlan] = useState("annual");

  // Pillar copy must match what actually ships. Each pillar below maps to
  // a real feature with shipping code:
  //   Ask Vela              → /api/ask-vela Netlify function (Claude-backed)
  //   Personalized suggestions → suggestExperiments + Insights "Vela suggests"
  //   doctor-ready report   → generateDoctorReport (jsPDF)
  //   experiments           → EXPERIMENT_LIBRARY + compareExperiment
  //   cycle prediction      → predictNextCycle on Insights
  //   weekly summary        → buildWeeklySummary + sheet
  //   Apple Health sync     → src/healthkit.js wrapper
  //   pattern history       → History screen unlock past 7 days
  // Don't add a pillar without a wired feature behind it.
  //
  // Order matters: Ask Vela + personalized suggestions lead because
  // they're the differentiation tier vs Caria/Balance/Flo. Doctor PDF
  // (the original hero) sits at #3 — still the most concrete benefit
  // for the doctor-prep persona, but no longer carries the whole pitch.
  const pillars = [
    {
      icon: "ChatCircle",
      tone: "sage",
      title: "Ask Vela",
      body: "Real AI grounded in your data. Not generic web advice. Ask anything about your symptoms, sleep, cycle, or what to bring to your next appointment.",
    },
    {
      icon: "SunHorizon",
      tone: "clay",
      title: "Daily brief",
      body: "A 2-3 sentence read on your week, fresh each morning. Vela writes it from your anonymized data. Not a feed of generic tips.",
    },
    {
      icon: "Sparkle",
      tone: "gold",
      title: "Personalized suggestions",
      body: "Vela watches your patterns and suggests experiments tied to what's actually showing up in your data. Not a generic to-do list.",
    },
    {
      icon: "FileText",
      tone: "clay",
      title: "Doctor-ready report",
      body: "A printable PDF your provider will actually read. 12 weeks of trends, top-symptom charts, mood and sleep by week, and detected correlations.",
    },
    {
      icon: "Flask",
      tone: "sage",
      title: "Run experiments",
      body: "Pick one change for 7-14 days. Caffeine cutoff, evening walks, magnesium. Vela compares the symptom days against the week before.",
    },
    {
      icon: "Calendar",
      tone: "gold",
      title: "Cycle prediction",
      body: "Even when cycles are irregular, Vela learns your rhythm and gives you a window for what's likely next.",
    },
    {
      icon: "Eye",
      tone: "sage",
      title: "Tomorrow forecast",
      body: "A quiet heads-up on what tomorrow may bring. Built from your cycle phase, recent triggers, and how your body has felt the past two days.",
    },
    {
      icon: "MagnifyingGlass",
      tone: "gold",
      title: "Anomaly insights",
      body: "When this week diverges from your personal baseline, Vela tells you out loud. Mood lower, sleep shorter, a symptom showing up more often than usual.",
    },
    {
      icon: "Sparkle",
      tone: "clay",
      title: "Weekly summary",
      body: "A quiet read on your week, ready whenever you open Insights. Top symptoms, sleep, mood, what shifted. One scroll, no work.",
    },
    {
      icon: "Heart",
      tone: "sage",
      title: "Apple Health sync",
      body: "Pull sleep hours from your watch automatically, so you don't retype what your wrist already knows.",
    },
    {
      icon: "ChartBar",
      tone: "gold",
      title: "Full pattern history",
      body: "Scroll back to any day you've logged. Free shows the last 7 days.",
    },
  ];

  const ctaPrice = plan === "annual" ? "$69.99/yr" : "$8.99/mo";

  return (
    <div className="pw-app">
      <button className="pw-close" onClick={onClose} aria-label="Close">×</button>

      <div className="pw-scroll">
        <span className="pw-eyebrow">
          <span className="crest"><UIIcon name="Star" size={11} weight="fill" /></span>
          Vela Premium
        </span>

        <h1 className="pw-headline">
          Make sense of it. <em>Out loud.</em>
        </h1>
        <p className="pw-sub">
          Real AI grounded in your data, personalized experiments from your patterns, and a doctor-ready report. Built for the years between.
        </p>

        {/* Hero. Doctor report preview */}
        <div className="pw-hero">
          <div className="pw-hero-row">
            <span className="badge"><UIIcon name="FileText" size={18} /></span>
            <div className="title">
              Your <em>doctor report</em>
              <small>12 weeks · charts · printable PDF</small>
            </div>
          </div>
          <div className="pw-pdf">
            <div className="pdf-head">
              <span className="name">Vela Symptom Report</span>
              <span className="meta">PDF · 1 page</span>
            </div>
            <div className="pdf-line" />
            <div className="pdf-line short" />
            <div className="pdf-line shorter" />
            <div className="pdf-mini-chart">
              {[0.4, 0.6, 0.5, 0.8, 0.7, 0.9, 0.65, 0.55, 0.75, 0.85, 0.6, 0.7].map((h, i) => (
                <span key={i} style={{ height: `${h * 100}%` }} />
              ))}
            </div>
            <div className="pdf-foot">Top symptom · last 12 weeks</div>
          </div>
        </div>

        {/* Pillars */}
        <div className="pw-pillars">
          {pillars.map((p) => (
            <div key={p.title} className={`pw-pillar ${p.tone}`}>
              <span className="ico"><UIIcon name={p.icon} size={18} /></span>
              <div>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quote. Kept generic, not a fabricated testimonial */}
        <div className="pw-quote">
          <p className="body">
            "Walk into your appointment armed with data, not vibes."
          </p>
          <div className="who"><strong>Why Vela exists</strong> · Built for the years between</div>
        </div>

        {/* Plans */}
        <div className="pw-plans">
          <button
            type="button"
            className={`pw-plan ${plan === "annual" ? "on" : ""}`}
            onClick={() => setPlan("annual")}
          >
            <span className="save-badge">Save 35%</span>
            <div className="term">Annual</div>
            <div className="price">$69.99<small>/yr</small></div>
            <div className="note">$5.83/mo · billed yearly</div>
          </button>
          <button
            type="button"
            className={`pw-plan ${plan === "monthly" ? "on" : ""}`}
            onClick={() => setPlan("monthly")}
          >
            <div className="term">Monthly</div>
            <div className="price">$8.99<small>/mo</small></div>
            <div className="note">Cancel anytime</div>
          </button>
        </div>
      </div>

      <div className="pw-cta-bar">
        <button type="button" className="pw-cta" onClick={() => onSubscribe(plan)}>
          Try free for 14 days · then {ctaPrice}
        </button>
        <div className="pw-cta-fine">
          Cancel anytime ·{" "}
          <a href="/terms.html" target="_blank" rel="noreferrer">Terms</a> ·{" "}
          <a href="/privacy.html" target="_blank" rel="noreferrer">Privacy</a>
        </div>
        <div className="pw-restore">
          Already a member? <button type="button" onClick={onRestore}>Restore purchase</button>
        </div>
      </div>
    </div>
  );
}
