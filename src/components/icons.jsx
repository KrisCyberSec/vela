// Phosphor icon registry + the four React components that wrap them.
//
// SymptomIcon - symptom tiles. Duotone weight by default. Falls back to
// rendering the raw glyph string for user-defined custom symptoms.
// UIIcon       - generic Phosphor wrapper used by settings rows, energy
// chips, the reveal carousel, the theme toggle, etc.
// MoodFace     - hand-drawn SVG face that follows currentColor.
// EnergyGlyph  - five ascending bars; filled count = level.
// RevealChart  - 7-day mini bar chart used in the reveal carousel.

import {
  // Symptom-tile icons
  Flame, MoonStars, Bed, Brain, HeartHalf, BatteryLow, CloudLightning, Lightning,
  CloudMoon, Heartbeat, Question, ChatTeardrop, Target, Waveform, HourglassLow,
  Aperture, Sparkle, Bone, PersonSimple, Spiral, Snowflake, ArrowsClockwise,
  SpeakerHigh, Hand, Footprints, Drop, SunDim, Heart, Scales, DropHalfBottom,
  HeartBreak, Circle, Smiley, ArrowUp, ArrowRight, Repeat, Wind, Eye, Tooth, Bug,
  // UI / settings icons
  Flower, Palette, Bell, ListChecks, SunHorizon, Moon, Calendar, CheckCircle, Star,
  Lock, FileText, DeviceMobile, ChartBar, MagnifyingGlass, Flask, Lightbulb,
  FirstAidKit, ChatCircle, ChatCircleText, Sun, Gear,
  // Energy-chip icons
  BatteryEmpty, BatteryMedium, BatteryHigh, BatteryFull,
} from "@phosphor-icons/react";

const SYMPTOM_ICONS = {
  Flame, MoonStars, Bed, Brain, HeartHalf, BatteryLow, CloudLightning, Lightning,
  CloudMoon, Heartbeat, Question, ChatTeardrop, Target, Waveform, HourglassLow,
  Aperture, Sparkle, Bone, PersonSimple, Spiral, Snowflake, ArrowsClockwise,
  SpeakerHigh, Hand, Footprints, Drop, SunDim, Heart, Scales, DropHalfBottom,
  HeartBreak, Circle, Smiley, ArrowUp, Repeat, Wind, Eye, Tooth, Bug,
};

export function SymptomIcon({ name, size = 24, weight = "duotone", style }) {
  const Cmp = SYMPTOM_ICONS[name];
  // Fallback for custom user-defined symptoms (still using glyph string)
  if (!Cmp) {
    return <span style={{ fontSize: size, lineHeight: 1, ...style }}>{name}</span>;
  }
  return <Cmp size={size} weight={weight} style={style} />;
}

// UI icons (settings rows, energy chips, reveal carousel, theme toggle, etc.)
// Same Phosphor duotone treatment as SymptomIcon. We bundle every imported
// Phosphor name here so any UIIcon name="…" call resolves - the redesign
// refactor introduced new call sites (ArrowRight chevrons, pattern cards
// referencing Bed/Wind, onboarding chip icons) that previously rendered as
// empty squares because the registry was symptom-only.
const UI_ICONS = {
  // Original UI set
  Flower, Palette, Bell, ListChecks, SunHorizon, Moon, Calendar, CheckCircle, Star,
  Lock, FileText, DeviceMobile, ChartBar, MagnifyingGlass, Flask, Lightbulb,
  FirstAidKit, ChatCircle, ChatCircleText, Sun, Gear, Sparkle, Eye, Target, Brain,
  BatteryEmpty, BatteryLow, BatteryMedium, BatteryHigh, BatteryFull,
  // Chevrons / arrows used by row CTAs and the doctor-report card
  ArrowRight, ArrowUp,
  // Symptom-domain icons surfaced in pattern cards, shelf items, onboarding
  // chip selectors, and Today triggers
  Flame, MoonStars, Bed, HeartHalf, CloudLightning, Lightning, CloudMoon,
  Heartbeat, ChatTeardrop, Waveform, HourglassLow, Aperture, Bone, PersonSimple,
  Spiral, Snowflake, ArrowsClockwise, SpeakerHigh, Hand, Footprints, Drop, SunDim,
  Heart, Scales, DropHalfBottom, HeartBreak, Circle, Smiley, Repeat, Wind, Tooth,
  Bug, Question,
};

export function UIIcon({ name, size = 22, weight = "duotone", style }) {
  const Cmp = UI_ICONS[name];
  if (!Cmp) return null;
  return <Cmp size={size} weight={weight} style={style} />;
}

// Hand-drawn mood face - single SVG follows currentColor so the active state
// lights up in clay just like the rest of the system. Five expressive levels
// instead of system emojis (which look childish for the audience).
export function MoodFace({ kind, size = 30 }) {
  const stroke = 7;
  const eye = (cx, cy) => <circle key={cx + ":" + cy} cx={cx} cy={cy} r="6" fill="currentColor" />;
  const mouths = {
    rough: <path d="M58 78 Q64 70 72 71 Q80 72 86 78" />,
    low:   <path d="M58 76 Q72 73 86 76" />,
    okay:  <path d="M58 74 L86 74" />,
    good:  <path d="M58 71 Q72 79 86 71" />,
    great: <path d="M56 68 Q72 86 88 68" />,
  };
  const eyeY = kind === "rough" || kind === "low" ? 56 : 54;
  return (
    <svg width={size} height={size} viewBox="0 0 144 144" aria-hidden="true">
      <circle cx="72" cy="72" r="58" fill="currentColor" opacity="0.16" />
      {eye(54, eyeY)}
      {eye(90, eyeY)}
      <g fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round">
        {mouths[kind]}
      </g>
    </svg>
  );
}

// Energy glyph - five ascending bars, filled count = level. Replaces the
// emoji battery progression with something that follows currentColor and
// scales cleanly at any size.
export function EnergyGlyph({ level, size = 30 }) {
  const bars = 5;
  const barW = 5;
  const gap = 2;
  const totalW = bars * barW + (bars - 1) * gap;
  return (
    <svg width={size} height={(size * 22) / 30} viewBox={`0 0 ${totalW} 22`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => {
        const h = 4 + i * 3.5;
        const x = i * (barW + gap);
        const y = 20 - h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx="1.5"
            fill="currentColor"
            opacity={i < level ? 0.95 : 0.16}
          />
        );
      })}
    </svg>
  );
}

// Mini bar chart for the reveal card. Pure SVG, brand-tinted via currentColor.
// Bars are derived from the user's real logs - never fabricated. For
// "building" state the past 7 days show actual symptom counts (height
// scales to the local max), and any future days within the week render
// as dimmed empty bars. Past days with no log render as dim too, so
// "I haven't done anything yet" reads honestly instead of looking like
// random data the user didn't enter.
export function RevealChart({ kind, logs = [] }) {
  if (kind === "none") return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  // Build the trailing 7 days, ending today
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayLogs = logs.filter((l) => l.date.slice(0, 10) === ymd);
    const symptomCount = new Set(dayLogs.flatMap((l) => Object.keys(l.symptoms || {}))).size;
    days.push({
      letter: ["S", "M", "T", "W", "T", "F", "S"][d.getDay()],
      count: dayLogs.length > 0 ? Math.max(symptomCount, 1) : 0,
      logged: dayLogs.length > 0,
    });
  }
  const maxCount = Math.max(...days.map((x) => x.count), 1);
  return (
    <div className="reveal-mini-chart">
      {days.map((day, i) => {
        const heightPct = day.logged ? (day.count / maxCount) * 100 : 18;
        return (
          <div
            key={i}
            className={`bar ${day.logged ? "" : "dim"}`}
            style={{ height: `${heightPct}%`, minHeight: 4 }}
          >
            <div className="cap" />
            <div className="label">{day.letter}</div>
          </div>
        );
      })}
    </div>
  );
}
