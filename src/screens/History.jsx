// History (Journal) screen. The user's chronological record - a stat
// strip, a per-day calendar heatmap, optional filter chips, and a
// newest-first entries feed with a tap-to-expand day-detail sheet.
// Non-premium users see the last seven days plus a locked-history banner.

import { useState } from "react";

import { SymptomIcon, UIIcon, MoodFace } from "../components/icons";

import { computeGamificationStats } from "../lib/gamification";
import { haptic } from "../lib/haptic";
import { SYMPTOMS } from "../lib/symptoms";

export default function HistoryScreen({ logs, isPremium, onShowPaywall, onNavigate }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [filter, setFilter] = useState(null);
  const [openDay, setOpenDay] = useState(null);
  // Entries feed cap - show recent N days by default. The calendar above
  // already gives the spatial overview, so the textual feed can be tighter.
  // Filter implies a search across all data, so it disables the cap.
  const FEED_CAP_DAYS = 14;
  const [showAllEntries, setShowAllEntries] = useState(false);

  const TODAY = new Date();
  // MoodFace replaces system emoji here (same reason as Today/Insights -
  // emoji yellow smileys read childish for the 45-55 audience).
  const MOOD_KIND_HX = ["rough", "low", "okay", "good", "great"];
  const MOOD_LABEL_HX = ["Rough", "Low", "Okay", "Good", "Great"];

  // ─── Build a normalized entries array from real logs ────────────────────
  // Each log groups by day and merges into one entry per day.
  const dailyEntries = (() => {
    const byDay = {};
    logs.forEach((l) => {
      const dayIso = l.date.slice(0, 10);
      const date = new Date(dayIso + "T12:00:00");
      if (!byDay[dayIso]) {
        byDay[dayIso] = {
          d: dayIso,
          date,
          mood: null,
          symptoms: [],
          severities: {},
          sleep: null,
          stress: null,
          period: null,
          notes: null,
          time: null,
        };
      }
      const e = byDay[dayIso];
      // Track latest log time
      const t = new Date(l.date);
      if (!e.time || t > e.time) e.time = t;
      if (l.mood !== null && l.mood !== undefined) e.mood = l.mood;
      Object.keys(l.symptoms || {}).forEach((name) => {
        if (!e.symptoms.find((s) => s.n === name)) {
          const def = SYMPTOMS.find((s) => s.name === name);
          e.symptoms.push({ n: name, icon: def?.icon || "Sparkle" });
        }
        if (l.severities?.[name]) e.severities[name] = l.severities[name];
      });
      if (l.context?.sleepHours != null) e.sleep = l.context.sleepHours;
      if (l.context?.stress != null) e.stress = l.context.stress;
      if (l.context?.period && l.context.period !== "none") {
        e.period = l.context.period.charAt(0).toUpperCase() + l.context.period.slice(1);
      }
      if (l.notes && (!e.notes || l.notes.length > e.notes.length)) e.notes = l.notes;
    });
    return Object.values(byDay).sort((a, b) => a.date - b.date);
  })();

  if (dailyEntries.length === 0) {
    return (
      <div className="screen active">
        <section className="history-greeting">
          <h1>Your <em>journal.</em></h1>
          <p className="meta">Begin your record</p>
        </section>
        <section className="empty-card">
          <div className="glyph"><UIIcon name="FileText" size={26} /></div>
          <h3>Your story <em>starts today.</em></h3>
          <p>Each entry builds a picture of your patterns. After seven days, Vela starts connecting the dots. Until then, this is your private journal.</p>
          <button className="cta" type="button" onClick={() => onNavigate && onNavigate("tracker")}>
            <UIIcon name="Sparkle" size={14} /> Log your first entry
          </button>
        </section>
      </div>
    );
  }

  // Apply filter
  const filteredEntries = filter
    ? dailyEntries.filter((e) => e.symptoms.some((s) => s.n === filter))
    : dailyEntries;

  // Reverse for newest-first display
  const allVisibleEntries = [...filteredEntries].reverse();
  // Cap to the most recent N days unless filtering or user expanded.
  // Older entries remain accessible via the calendar above (which always
  // shows the full month) and via the "Show older" button at the feed's end.
  const cappedFeed = !filter && !showAllEntries && allVisibleEntries.length > FEED_CAP_DAYS;
  const visibleEntries = cappedFeed ? allVisibleEntries.slice(0, FEED_CAP_DAYS) : allVisibleEntries;
  const hiddenOlderCount = allVisibleEntries.length - visibleEntries.length;

  // ─── Stats ────────────────────────────────────────────────────────────────
  const totalEntries = dailyEntries.length;
  const stats = computeGamificationStats(logs);
  const currentStreak = stats.streak;
  const longestStreak = (() => {
    if (dailyEntries.length === 0) return 0;
    let cur = 1, best = 1;
    for (let i = 1; i < dailyEntries.length; i++) {
      const prev = dailyEntries[i - 1].date;
      const curD = dailyEntries[i].date;
      const diffDays = Math.round((curD - prev) / 86400000);
      if (diffDays === 1) { cur++; best = Math.max(best, cur); } else { cur = 1; }
    }
    return best;
  })();

  // ─── Top symptoms for filter chips ────────────────────────────────────────
  const symFreq = {};
  dailyEntries.forEach((e) => e.symptoms.forEach((s) => { symFreq[s.n] = (symFreq[s.n] || 0) + 1; }));
  const topSymptoms = Object.entries(symFreq).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // ─── Calendar setup ──────────────────────────────────────────────────────
  const base = new Date(TODAY); base.setDate(1); base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear(); const month = base.getMonth();
  const monthLong = base.toLocaleDateString("en-US", { month: "long" });
  const yearStr = String(year);
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function dateIso(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  const lockedBefore = !isPremium ? (() => { const d = new Date(TODAY); d.setDate(d.getDate() - 7); d.setHours(0,0,0,0); return d; })() : null;

  function loadClass(entry) {
    if (!entry) return "";
    const c = entry.symptoms?.length || 0;
    if (c === 0) return "has-entry";
    if (c <= 1) return "has-entry";
    if (c <= 2) return "h2";
    if (c <= 3) return "h3";
    return "h4";
  }

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push({ empty: true, key: `e-${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayIso = dateIso(date);
    const entry = dailyEntries.find((e) => e.d === dayIso);
    const isFuture = date > TODAY;
    const isToday = dayIso === dateIso(TODAY);
    const locked = lockedBefore && date < lockedBefore && !isFuture;
    cells.push({ key: dayIso, day: d, entry, isFuture, isToday, locked, dayIso });
  }

  const lockedCount = lockedBefore ? dailyEntries.filter((e) => e.date < lockedBefore).length : 0;

  // Group visible entries by day for the feed
  const grouped = (() => {
    const map = new Map();
    visibleEntries.forEach((e) => {
      if (!map.has(e.d)) map.set(e.d, []);
      map.get(e.d).push(e);
    });
    return Array.from(map.entries());
  })();

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const openEntry = openDay ? dailyEntries.find((e) => e.d === openDay) : null;

  return (
    <div className="screen active">
      <section className="history-greeting">
        <h1>Your <em>journal.</em></h1>
        <p className="meta">
          {!isPremium ? `Last 7 days${lockedCount > 0 ? ` · ${lockedCount} more locked` : ""}` : `${totalEntries} entries`}
          <span className="dot">·</span>{today}
        </p>
      </section>

      {/* Stats strip */}
      <div className="streak-strip">
        <div className="stat-cell">
          <div className="v">{currentStreak}<small>{currentStreak === 1 ? "day" : "days"}</small></div>
          <div className="l">Current streak</div>
        </div>
        <div className="stat-cell">
          <div className="v">{longestStreak}<small>{longestStreak === 1 ? "day" : "days"}</small></div>
          <div className="l">Longest run</div>
        </div>
        <div className="stat-cell">
          <div className="v">{totalEntries}</div>
          <div className="l">{totalEntries === 1 ? "Total entry" : "Total entries"}</div>
        </div>
      </div>

      {/* Calendar */}
      <div className="today-section-label"><span>Calendar</span></div>
      <section className="cal-card">
        <div className="cal-head">
          <div className="cal-month">{monthLong} <em>{yearStr}</em></div>
          <div className="cal-nav">
            <button type="button" onClick={() => setMonthOffset(monthOffset - 1)} aria-label="Previous month">‹</button>
            <button type="button" onClick={() => setMonthOffset(Math.min(0, monthOffset + 1))} disabled={monthOffset >= 0} aria-label="Next month">›</button>
          </div>
        </div>
        <div className="cal-dows">
          {["S","M","T","W","T","F","S"].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="cal-grid">
          {cells.map((c) => {
            if (c.empty) return <div key={c.key} className="cal-cell empty" />;
            const cls = ["cal-cell", c.isFuture ? "future" : "", c.isToday ? "today" : "", c.locked ? "locked" : loadClass(c.entry)].filter(Boolean).join(" ");
            return (
              <button key={c.key} className={cls} onClick={() => !c.isFuture && !c.locked && c.entry && setOpenDay(c.dayIso)}>
                <span>{c.day}</span>
                {c.entry?.period && <span className="period" />}
              </button>
            );
          })}
        </div>
        <div className="cal-legend">
          <span className="row">Symptom load
            <span className="scale">
              <i style={{ background: "rgba(201,123,92,0.18)" }} />
              <i style={{ background: "rgba(201,123,92,0.32)" }} />
              <i style={{ background: "rgba(201,123,92,0.50)" }} />
              <i style={{ background: "var(--clay)" }} />
            </span>
          </span>
          <span className="row" style={{ marginLeft: "auto" }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: "var(--sage-dark)", display: "inline-block" }} /> Period
          </span>
        </div>
      </section>

      {/* Filter chips */}
      {topSymptoms.length > 0 && (
        <>
          <div className="today-section-label">
            <span>Filter</span>
            {filter && <span className="hint">showing "{filter}"</span>}
          </div>
          <div className="filter-row">
            <button className={`filter-chip${filter === null ? " on" : ""}`} onClick={() => setFilter(null)}>All</button>
            {topSymptoms.map(([name, ct]) => (
              <button
                key={name}
                className={`filter-chip${filter === name ? " on" : ""}`}
                onClick={() => setFilter(filter === name ? null : name)}
              >
                {name} <span className="ct">{ct}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Entries feed */}
      <div className="today-section-label">
        <span>Entries</span>
        <span className="hint">
          {cappedFeed
            ? `Recent ${visibleEntries.length} of ${allVisibleEntries.length} · newest first`
            : `${visibleEntries.length} shown · newest first`}
        </span>
      </div>

      {grouped.map(([dayIso, items]) => {
        const date = items[0].date;
        const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
        const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const diffDays = Math.round((TODAY.setHours(0,0,0,0) - new Date(date).setHours(0,0,0,0)) / 86400000);
        const relative = diffDays === 0 ? "Today" : diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
        const [mon, dnum] = monthDay.split(" ");
        return (
          <div key={dayIso} className="day-group">
            <div className="day-label">
              <span className="num">{mon} <em>{dnum}</em></span>
              <span className="day">{dayName}</span>
              <span className="relative">{relative}</span>
            </div>
            {items.map((entry, i) => {
              const standout = entry.symptoms.length === 0 && entry.mood >= 3;
              const timeStr = entry.time
                ? entry.time.toLocaleTimeString("en-US", { hour: "numeric" }).replace(" ", "").toLowerCase()
                : "";
              return (
                <button
                  key={i}
                  type="button"
                  className={`entry-card${standout ? " standout" : ""}`}
                  onClick={() => setOpenDay(entry.d)}
                >
                  <div className="top-row">
                    <span className="e-mood" style={{ color: "var(--clay)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      {entry.mood !== null ? <MoodFace kind={MOOD_KIND_HX[entry.mood]} size={26} /> : "·"}
                    </span>
                    <div className="e-meta">
                      <strong>{entry.mood !== null ? MOOD_LABEL_HX[entry.mood] : "Logged"}</strong>
                      {entry.symptoms.length > 0 && <> · {entry.symptoms.length} symptom{entry.symptoms.length !== 1 ? "s" : ""}</>}
                      {entry.symptoms.length === 0 && entry.mood !== null && " · clear day"}
                    </div>
                    <span className="e-time">{timeStr}</span>
                  </div>
                  {entry.symptoms.length > 0 && (
                    <div className="e-pills">
                      {entry.symptoms.slice(0, 4).map((s) => (
                        <span key={s.n} className="pill">
                          <SymptomIcon name={s.icon} size={11} />
                          {s.n}
                        </span>
                      ))}
                      {entry.period && <span className="pill sage"><UIIcon name="Drop" size={11} />{entry.period}</span>}
                    </div>
                  )}
                  {entry.notes && <div className="e-note">"{entry.notes}"</div>}
                  {(entry.sleep != null || entry.stress != null) && (
                    <div className="e-context">
                      {entry.sleep != null && <span><UIIcon name="Bed" size={12} /> <strong>{entry.sleep}h</strong> sleep</span>}
                      {entry.stress != null && <span><UIIcon name="CloudLightning" size={12} /> stress <strong>{entry.stress}/5</strong></span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}

      {/* Show-older affordance. When feed is capped */}
      {cappedFeed && (
        <button
          type="button"
          className="filter-chip"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            margin: "16px auto 4px", padding: "10px 18px", background: "var(--card-bg)",
            border: "1px solid var(--border)", borderRadius: 14,
            color: "var(--clay-dark)", fontWeight: 600, fontSize: 13,
            width: "auto", maxWidth: 280,
          }}
          onClick={() => setShowAllEntries(true)}
        >
          <UIIcon name="ArrowUp" size={12} style={{ transform: "rotate(180deg)" }} />
          Show {hiddenOlderCount} older {hiddenOlderCount === 1 ? "entry" : "entries"}
        </button>
      )}
      {!cappedFeed && allVisibleEntries.length > FEED_CAP_DAYS && !filter && (
        <button
          type="button"
          className="filter-chip"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            margin: "16px auto 4px", padding: "10px 18px", background: "transparent",
            border: "1px solid var(--border)", borderRadius: 14,
            color: "var(--ink-light)", fontWeight: 500, fontSize: 12,
            width: "auto", maxWidth: 280,
          }}
          onClick={() => setShowAllEntries(false)}
        >
          Collapse to recent {FEED_CAP_DAYS} days
        </button>
      )}

      {/* Locked banner for non-premium users */}
      {!isPremium && lockedCount > 0 && (
        <div className="lock-banner">
          <div className="ico"><UIIcon name="Lock" size={20} /></div>
          <h4>{lockedCount} more days of <em>your story</em></h4>
          <p>Free tier shows your last 7 days. Vela Premium unlocks your full history, exports, and pattern tracking across cycles.</p>
          <button type="button" onClick={() => onShowPaywall("locked_banner")}>Unlock with Premium</button>
        </div>
      )}

      <div className="privacy-footer">
        <UIIcon name="Lock" size={12} />
        <span>Your journal stays on this device.</span>
      </div>

      {/* Day detail bottom sheet */}
      <div className={`dd-scrim${openDay ? " show" : ""}`} onClick={() => setOpenDay(null)} />
      <aside className={`dd-sheet${openDay ? " show" : ""}`} role="dialog" aria-modal="true">
        <div className="dd-handle" />
        {openEntry && (
          <>
            <div className="dd-head">
              <div className="num">
                {openEntry.date.toLocaleDateString("en-US", { month: "short" })} <em>{openEntry.date.getDate()}</em>
              </div>
              <div className="day">{openEntry.date.toLocaleDateString("en-US", { weekday: "long" })}</div>
            </div>

            {openEntry.mood !== null && (
              <div className="dd-section">
                <div className="dd-label">Mood</div>
                <div className="dd-mood-row">
                  <span className="em" style={{ color: "var(--clay)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <MoodFace kind={MOOD_KIND_HX[openEntry.mood]} size={36} />
                  </span>
                  <div className="lbl">
                    {MOOD_LABEL_HX[openEntry.mood]}
                    {openEntry.time && <small>logged at {openEntry.time.toLocaleTimeString("en-US", { hour: "numeric" }).replace(" ", "").toLowerCase()}</small>}
                  </div>
                </div>
              </div>
            )}

            {openEntry.symptoms.length > 0 && (
              <div className="dd-section">
                <div className="dd-label">Symptoms</div>
                <div className="dd-pills">
                  {openEntry.symptoms.map((s) => (
                    <span key={s.n} className="dd-pill">
                      <SymptomIcon name={s.icon} size={12} />
                      {s.n}
                      {openEntry.severities[s.n] && <span className="sev">{openEntry.severities[s.n]}/3</span>}
                    </span>
                  ))}
                  {openEntry.period && (
                    <span className="dd-pill" style={{ background: "var(--sage-light)", color: "var(--sage-dark)" }}>
                      <UIIcon name="Drop" size={12} />
                      {openEntry.period}
                    </span>
                  )}
                </div>
              </div>
            )}

            {(openEntry.sleep != null || openEntry.stress != null) && (
              <div className="dd-section">
                <div className="dd-label">Context</div>
                <div className="dd-context-grid">
                  {openEntry.sleep != null && (
                    <div className="dd-context-cell">
                      <div className="lab"><UIIcon name="Bed" size={12} /> Sleep</div>
                      <div className="v">{openEntry.sleep}<small>hrs</small></div>
                    </div>
                  )}
                  {openEntry.stress != null && (
                    <div className="dd-context-cell">
                      <div className="lab"><UIIcon name="CloudLightning" size={12} /> Stress</div>
                      <div className="v">{openEntry.stress}<small>/5</small></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {openEntry.notes && (
              <div className="dd-section">
                <div className="dd-label">Note</div>
                <div className="dd-note">"{openEntry.notes}"</div>
              </div>
            )}

            {/* Cross-screen action: jump straight into Ask Vela with this
                day pre-loaded as the question. Closes the sheet and
                navigates to Insights. The pending-question stash gets
                read + cleared by InsightsScreen on mount. */}
            <div className="dd-section" style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
              <button
                type="button"
                className={`dd-ask-btn${!isPremium ? " locked" : ""}`}
                onClick={() => {
                  // Ask Vela is premium. Free users hit the paywall here
                  // instead of getting a confusing 403 from the chat sheet
                  // after the question pre-fills + auto-submits.
                  if (!isPremium) { setOpenDay(null); onShowPaywall("day_ask"); return; }
                  const dateLabel = openEntry.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
                  const symList = openEntry.symptoms.length > 0
                    ? openEntry.symptoms.map((s) => s.n).join(", ")
                    : "no symptoms";
                  const question = `What's going on with my ${dateLabel}? I logged ${symList}${openEntry.mood !== null ? `, mood was ${MOOD_LABEL_HX[openEntry.mood].toLowerCase()}` : ""}${openEntry.sleep != null ? `, ${openEntry.sleep}h of sleep` : ""}.`;
                  try { localStorage.setItem("vela_pending_question", question); } catch { /* private mode */ }
                  setOpenDay(null);
                  if (onNavigate) onNavigate("insights");
                  haptic("Light");
                }}
              >
                {!isPremium && <UIIcon name="Star" size={11} weight="fill" />}
                <UIIcon name="ChatCircle" size={14} />
                {isPremium ? "Ask Vela about this day" : "Ask Vela about this day · Premium"}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
