// User settings screen. Surfaces the "your record" journey card (days /
// streak / entries pulled from gamification stats + correlation quote),
// profile rows that deep-link to the EditQuestion flow, subscription
// status with Ask Vela quota for premium users, reminder toggles and
// per-cadence time pickers, theme picker, Apple Health connection,
// privacy + analytics opt-out, doctor report / CSV export, and the
// reset-all-data danger button. Hidden 5-tap debug entry lives in the
// footer.

import { useEffect, useState } from "react";

import {
  isAnalyticsOptedOut,
  setAnalyticsOptedOut,
} from "../analytics";
import {
  disableHealthKit,
  enableHealthKit,
  getHealthKitStatus,
  isHealthKitEnabled,
} from "../healthkit";
import { getThemePref, setTheme } from "../theme";

import { UIIcon } from "../components/icons";

import { analyzeCorrelations } from "../lib/correlations";
import { exportCSV } from "../lib/csv";
import { generateDoctorReport } from "../lib/doctorReport";
import { getJourneyLabel } from "../lib/formatters";
import { computeGamificationStats } from "../lib/gamification";
import { haptic } from "../lib/haptic";
import { getThumbsUpInsights } from "../lib/insightFeedback";
import { ASK_VELA_MONTHLY_CAP, getMonthlyCount } from "../lib/quota";

export default function SettingsScreen({ profile, logs, isPremium, onShowPaywall, onEditQuestion, onClearData, remindersEnabled, onToggleReminders, reminderTimes, onUpdateReminderTime, onNavigate }) {
  const [themePref, setThemePref] = useState(() => getThemePref());
  const [hkOn, setHkOn] = useState(() => isHealthKitEnabled());
  const [hkStatus, setHkStatus] = useState("checking");
  const [hkBusy, setHkBusy] = useState(false);
  const [analyticsOptOut, setAnalyticsOptOut] = useState(() => isAnalyticsOptedOut());
  useEffect(() => {
    let cancelled = false;
    getHealthKitStatus().then((s) => { if (!cancelled) setHkStatus(s); });
    return () => { cancelled = true; };
  }, []);

  async function toggleHealthKit() {
    if (!isPremium) { onShowPaywall("apple_health"); return; }
    if (hkStatus !== "available") return;
    setHkBusy(true);
    try {
      if (hkOn) {
        await disableHealthKit();
        setHkOn(false);
      } else {
        const r = await enableHealthKit();
        if (r.ok) setHkOn(true);
      }
    } finally {
      setHkBusy(false);
    }
  }

  const journeyStage = profile ? getJourneyLabel(profile[0]) : "Not set";
  const guidanceLabels = ["Daily check-ins", "Weekly summaries", "Only when I ask", "Let Vela decide"];
  const guidancePref = profile && profile[3] !== undefined && profile[3] !== null ? profile[3] : 3;
  const goalLabels = ["Understand my body", "Track for my doctor", "Find relief strategies", "Connect with others"];
  const goalArr = profile ? (Array.isArray(profile[2]) ? profile[2].map((i) => goalLabels[i]) : [goalLabels[profile[2]]]) : [];
  const goal = goalArr.length === 0 ? "Not set" : goalArr.length === 1 ? goalArr[0] : `${goalArr[0]} +${goalArr.length - 1} more`;
  const concernCount = profile && Array.isArray(profile[1]) ? profile[1].length : (profile?.[1] != null ? 1 : 0);

  const stats = computeGamificationStats(logs);
  const days = stats.uniqueDays;
  const streak = stats.streak;
  const entries = logs.length;

  // First log date for "Tracking since" — null when no logs (we hide
  // the line in the JSX rather than print "Tracking since today").
  const trackingSince = (() => {
    if (logs.length === 0) return null;
    const earliest = logs.map((l) => l.date).sort()[0];
    const d = new Date(earliest);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  })();

  // Position the marker on a 5-stage arc (Regular cycles → Perimenopause → Postmenopause → Surgical)
  const stagePosition = profile && profile[0] !== undefined ? [0.10, 0.45, 0.85, 0.65][profile[0]] || 0.45 : 0.45;

  // Recent quote — pull from the strongest correlation if we have one.
  // Empty-state copy avoids "journey" (banned brand-voice word).
  const correlations = analyzeCorrelations(logs);
  const journeyQuote = correlations[0]?.text
    || (days > 0 ? `${days} ${days === 1 ? "day" : "days"} in. Vela is still listening for the patterns that matter.` : "Your record starts the day you log your first entry.");

  return (
    <div className="screen active">
      <div className="set-greeting" style={{ padding: "0 0 18px" }}>
        <h1>Settings <em>&amp; you.</em></h1>
        <p className="meta">Profile, preferences, and exports.</p>
      </div>

      {/* Journey card. Replaces the old XP/level/badges grid */}
      <section className="journey-card">
        <span className="eye"><UIIcon name="Sparkle" size={11} /> Your record</span>
        <h2 className="name">
          {days < 7 ? <>Just <em>getting started.</em></>
            : days < 30 ? <>Building the <em>baseline.</em></>
            : <>{Math.floor(days/30)} {days < 60 ? "month" : "months"} in, <em>finding the rhythm.</em></>}
        </h2>
        {trackingSince && <p className="since">Tracking since {trackingSince}</p>}

        <div className="journey-grid">
          <div className="journey-cell">
            <div className="v">{days}<small>{days === 1 ? "day" : "days"}</small></div>
            <div className="l">Tracked</div>
          </div>
          <div className="journey-cell">
            <div className="v">{streak}<small>{streak === 1 ? "day" : "days"}</small></div>
            <div className="l">Current streak</div>
          </div>
          <div className="journey-cell">
            <div className="v">{entries}</div>
            <div className="l">{entries === 1 ? "Entry" : "Entries"}</div>
          </div>
        </div>

        <div className="journey-arc" aria-label="Stage marker">
          <span className="marker" style={{ left: `${stagePosition * 100}%` }} />
        </div>

        <p className="quote">"{journeyQuote}"</p>
      </section>

      {/* Patterns the user has thumbs-up'd in Insights, when any are
          still currently detected. Hidden when none, so it doesn't sit
          empty in the early-baseline weeks. Tap jumps to Insights. */}
      {(() => {
        const liked = getThumbsUpInsights(logs);
        if (liked.length === 0) return null;
        return (
          <>
            <div className="set-section-label"><span>Patterns you've marked helpful</span></div>
            <button
              type="button"
              className="set-recent"
              onClick={() => { haptic("Light"); if (onNavigate) onNavigate("insights"); }}
            >
              <span className="eye"><UIIcon name="Sparkle" size={11} /> Still surfacing</span>
              <ul>
                {liked.slice(0, 3).map((ins, i) => (
                  <li key={i}><UIIcon name="Heart" size={11} weight="fill" /> {ins.text}</li>
                ))}
              </ul>
              <span className="cta">See in Insights <UIIcon name="ArrowRight" size={12} /></span>
            </button>
          </>
        );
      })()}

      {/* Profile */}
      <div className="set-section-label"><span>Profile</span></div>
      <div className="set-card">
        <button className="set-row" onClick={() => onEditQuestion(0)}>
          <span className="glyph"><UIIcon name="Flower" size={16} /></span>
          <span className="body"><span className="label">Hormonal stage</span></span>
          <span className="value">{journeyStage || "Not set"}</span>
          <span className="arrow">›</span>
        </button>
        <button className="set-row" onClick={() => onEditQuestion(2)}>
          <span className="glyph"><UIIcon name="Target" size={16} /></span>
          <span className="body"><span className="label">Primary goal</span></span>
          <span className="value">{goal}</span>
          <span className="arrow">›</span>
        </button>
        <button className="set-row" onClick={() => onEditQuestion(1)}>
          <span className="glyph"><UIIcon name="MagnifyingGlass" size={16} /></span>
          <span className="body"><span className="label">Tracked concerns</span></span>
          <span className="value">{concernCount > 0 ? `${concernCount} chosen` : "Not set"}</span>
          <span className="arrow">›</span>
        </button>
      </div>

      {/* Subscription */}
      <div className="set-section-label"><span>Subscription</span></div>
      {isPremium ? (
        <div className="set-card">
          <div className="set-row" style={{ cursor: "default" }}>
            <span className="glyph" style={{ background: "var(--sage-light)", color: "var(--sage-dark)" }}><UIIcon name="CheckCircle" size={16} /></span>
            <span className="body">
              <span className="label">Vela Premium</span>
              <span className="sub">All features unlocked</span>
            </span>
            <span className="value sage">Active</span>
          </div>
          {(() => {
            // Ask Vela usage this month, so power users see they have plenty.
            const used = getMonthlyCount();
            const remaining = Math.max(0, ASK_VELA_MONTHLY_CAP - used);
            return (
              <div className="set-row" style={{ cursor: "default" }}>
                <span className="glyph"><UIIcon name="ChatCircle" size={16} /></span>
                <span className="body">
                  <span className="label">Ask Vela this month</span>
                  <span className="sub">{used} asked, {remaining} left of {ASK_VELA_MONTHLY_CAP}. Plus 30 a day, whichever comes first.</span>
                </span>
              </div>
            );
          })()}
        </div>
      ) : (
        <button className="set-premium-row" onClick={() => onShowPaywall("upgrade_row")}>
          <span className="crest"><UIIcon name="Star" size={20} /></span>
          <span className="body">
            <strong>Upgrade to Vela Premium</strong>
            <small>Ask Vela AI, doctor reports, cycle prediction, experiments</small>
          </span>
          <span className="cta">From $5.83/mo</span>
        </button>
      )}

      {/* Reminders */}
      <div className="set-section-label">
        <span>Reminders</span>
        {!remindersEnabled && <span style={{ fontSize: 11, color: "var(--ink-light)", textTransform: "none", letterSpacing: 0 }}>Off</span>}
      </div>
      <div className="set-card">
        <div className="set-row" style={{ cursor: "default" }}>
          <span className="glyph"><UIIcon name="Bell" size={16} /></span>
          <span className="body">
            <span className="label">Notifications</span>
            <span className="sub">{remindersEnabled ? "On" : "Off. You'll come to us"}</span>
          </span>
          <span
            className={`set-toggle${remindersEnabled ? " on" : ""}`}
            onClick={(e) => { e.stopPropagation(); onToggleReminders(!remindersEnabled); haptic("Light"); }}
            role="switch"
            aria-checked={remindersEnabled}
          >
            <span className="thumb" />
          </span>
        </div>
        <button className="set-row" onClick={() => onEditQuestion(3)}>
          <span className="glyph"><UIIcon name="ListChecks" size={16} /></span>
          <span className="body"><span className="label">Cadence</span></span>
          <span className="value">{guidanceLabels[guidancePref]}</span>
          <span className="arrow">›</span>
        </button>
        {remindersEnabled && guidancePref === 0 && (
          <>
            <div className="set-row" style={{ cursor: "default" }}>
              <span className="glyph"><UIIcon name="SunHorizon" size={16} /></span>
              <span className="body"><span className="label">Morning nudge</span></span>
              <input type="time" className="set-time" value={reminderTimes.morning} onChange={(e) => onUpdateReminderTime("morning", e.target.value)} />
            </div>
            <div className="set-row" style={{ cursor: "default" }}>
              <span className="glyph"><UIIcon name="Moon" size={16} /></span>
              <span className="body"><span className="label">Evening check-in</span></span>
              <input type="time" className="set-time" value={reminderTimes.evening} onChange={(e) => onUpdateReminderTime("evening", e.target.value)} />
            </div>
          </>
        )}
        {remindersEnabled && guidancePref === 1 && (
          <div className="set-row" style={{ cursor: "default" }}>
            <span className="glyph"><UIIcon name="Calendar" size={16} /></span>
            <span className="body"><span className="label">Sunday summary</span></span>
            <input type="time" className="set-time" value={reminderTimes.weekly} onChange={(e) => onUpdateReminderTime("weekly", e.target.value)} />
          </div>
        )}
        {(!remindersEnabled || guidancePref === 2) && (
          <div className="set-row" style={{ cursor: "default" }}>
            <span className="glyph"><UIIcon name="Smiley" size={16} /></span>
            <span className="body">
              <span className="label">{remindersEnabled ? "Quiet by design" : "We won't reach out"}</span>
              <span className="sub">Open Vela whenever you'd like</span>
            </span>
          </div>
        )}
      </div>

      {/* Appearance */}
      <div className="set-section-label"><span>Appearance</span></div>
      <div className="set-card">
        <div className="set-row" style={{ cursor: "default", borderBottom: "none" }}>
          <span className="glyph"><UIIcon name="Palette" size={16} /></span>
          <span className="body">
            <span className="label">Theme</span>
            <span className="sub">Candle mode is gentle on tired eyes</span>
          </span>
        </div>
        <div className="set-seg" role="radiogroup" aria-label="Theme">
          {[
            { id: "light", label: "Light", icon: "Sun" },
            { id: "system", label: "System", icon: "DeviceMobile" },
            { id: "dark", label: "Candle", icon: "Moon" },
          ].map((opt) => (
            <button
              key={opt.id}
              className={themePref === opt.id ? "on" : ""}
              onClick={() => { setTheme(opt.id); setThemePref(opt.id); haptic("Light"); }}
              role="radio"
              aria-checked={themePref === opt.id}
            >
              <UIIcon name={opt.icon} size={13} />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Connected health */}
      <div className="set-section-label"><span>Connected health</span></div>
      <div className="set-card">
        <button
          className="set-row"
          onClick={toggleHealthKit}
          disabled={hkBusy || (hkStatus !== "available" && isPremium)}
          style={{ opacity: (hkStatus !== "available" && isPremium) ? 0.55 : 1 }}
        >
          <span className="glyph" style={{ background: hkOn ? "var(--sage-light)" : undefined, color: hkOn ? "var(--sage-dark)" : undefined }}>
            <UIIcon name="Heart" size={16} weight={hkOn ? "fill" : "duotone"} />
          </span>
          <span className="body">
            <span className="label">Apple Health</span>
            <span className="sub">
              {!isPremium ? "Auto-fill sleep hours from your watch" :
                hkStatus === "no-native" ? "Available on iOS only" :
                hkStatus === "no-plugin" ? "Update Vela to enable Apple Health" :
                hkOn ? "Pulling sleep on every Today open" :
                "Tap to grant permission"}
            </span>
          </span>
          <span className={`value${!isPremium ? " gold" : hkOn ? " sage" : ""}`}>
            {!isPremium ? "Premium" : hkOn ? "On" : (hkStatus === "available" ? "Off" : "-")}
          </span>
        </button>
      </div>

      {/* Privacy & Data */}
      <div className="set-section-label"><span>Privacy &amp; Data</span></div>
      <div className="set-card">
        <button className="set-row" onClick={() => window.open("/privacy.html", "_blank")}>
          <span className="glyph"><UIIcon name="Lock" size={16} /></span>
          <span className="body"><span className="label">Privacy policy</span></span>
          <span className="arrow">›</span>
        </button>
        <button className="set-row" onClick={() => window.open("/terms.html", "_blank")}>
          <span className="glyph"><UIIcon name="FileText" size={16} /></span>
          <span className="body"><span className="label">Terms of service</span></span>
          <span className="arrow">›</span>
        </button>
        <div className="set-row" style={{ cursor: "default" }}>
          <span className="glyph"><UIIcon name="DeviceMobile" size={16} /></span>
          <span className="body">
            <span className="label">Data storage</span>
            <span className="sub">Stored on this device only. Never synced.</span>
          </span>
          <span className="value">On-device</span>
        </div>
        <div className="set-row" style={{ cursor: "default" }}>
          <span className="glyph"><UIIcon name="ChatCircle" size={16} /></span>
          <span className="body">
            <span className="label">What Ask Vela sends</span>
            <span className="sub">30-day counts and averages, plus a per-day breakdown of the last week. Never your notes, custom-symptom names, or exact dates.</span>
          </span>
        </div>
        <div className="set-row" style={{ cursor: "default" }}>
          <span className="glyph"><UIIcon name="ChartBar" size={16} /></span>
          <span className="body">
            <span className="label">Product analytics</span>
            <span className="sub">{analyticsOptOut ? "Off. Nothing is sent." : "On. Event names only (log saved, paywall shown, etc.). Never your symptom data."}</span>
          </span>
          <span
            className={`set-toggle${!analyticsOptOut ? " on" : ""}`}
            onClick={(e) => { e.stopPropagation(); const next = !analyticsOptOut; setAnalyticsOptedOut(next); setAnalyticsOptOut(next); haptic("Light"); }}
            role="switch"
            aria-checked={!analyticsOptOut}
            aria-label="Product analytics"
          >
            <span className="thumb" />
          </span>
        </div>
      </div>

      {/* Export */}
      <div className="set-section-label"><span>Export</span></div>
      <div className="set-card">
        <button
          className="set-row"
          onClick={() => {
            if (!isPremium) { onShowPaywall("doctor_report"); return; }
            generateDoctorReport(logs, profile);
          }}
        >
          <span className="glyph"><UIIcon name="FileText" size={16} /></span>
          <span className="body">
            <span className="label">Doctor report</span>
            <span className="sub">A printable PDF for your next appointment</span>
          </span>
          <span className={`value${isPremium ? "" : " gold"}`}>{isPremium ? "PDF" : "Premium"}</span>
        </button>
        <button
          className="set-row"
          onClick={() => exportCSV(logs)}
        >
          <span className="glyph"><UIIcon name="ChartBar" size={16} /></span>
          <span className="body">
            <span className="label">Export data</span>
            <span className="sub">CSV. For your records</span>
          </span>
          <span className="arrow">›</span>
        </button>
      </div>

      <button className="set-danger" onClick={onClearData}>Reset all data</button>

      <div className="set-footer">
        <div className="v">Vela 1.0.0</div>
        <div style={{ marginTop: 6 }}>Made for the years between.</div>
        <div style={{ marginTop: 6 }}>
          Questions? <a href="mailto:support@velahealth.health">support@velahealth.health</a>
        </div>
        <div style={{ marginTop: 12, maxWidth: 280, marginLeft: "auto", marginRight: "auto" }}>
          Vela is not medical advice. Please consult your healthcare provider.
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => {
              const count = parseInt(sessionStorage.getItem("_debug_taps") || "0") + 1;
              sessionStorage.setItem("_debug_taps", String(count));
              if (count >= 5) { sessionStorage.removeItem("_debug_taps"); onNavigate && onNavigate("debug"); }
            }}
            style={{ background: "transparent", border: "none", color: "var(--ink-light)", fontSize: 11, cursor: "default", userSelect: "none", padding: 4 }}
          >
            tap 5×
          </button>
        </div>
      </div>
    </div>
  );
}
