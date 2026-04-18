const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "Vela Health";
pres.title = "Vela - Menopause Companion";

// ─── COLOR PALETTE ─────────────────────────────────────────────────────────
const C = {
  dark: "1A1A2E",       // deep navy-black
  darkAlt: "222240",    // slightly lighter dark
  sage: "7A8B6F",       // sage green
  sageLt: "A3B196",     // light sage
  clay: "C97B5C",       // clay/copper accent
  gold: "D4A574",       // warm gold
  cream: "F5F0E8",      // warm cream text
  white: "FFFFFF",
  muted: "B8B0A4",      // muted text
  mutedDk: "8A8378",    // darker muted
  cardBg: "2A2A45",     // card background
};

// ─── HELPER: Fresh shadow factory ──────────────────────────────────────────
const cardShadow = () => ({ type: "outer", blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.25 });

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1: TITLE
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  // Decorative sage shape top-right
  s.addShape(pres.shapes.OVAL, { x: 7.5, y: -1.5, w: 4, h: 4, fill: { color: C.sage, transparency: 85 } });
  s.addShape(pres.shapes.OVAL, { x: 8.2, y: -0.8, w: 2.5, h: 2.5, fill: { color: C.sage, transparency: 90 } });

  // Decorative clay shape bottom-left
  s.addShape(pres.shapes.OVAL, { x: -1.5, y: 3.5, w: 4, h: 4, fill: { color: C.clay, transparency: 85 } });

  // App name
  s.addText("Vela", {
    x: 0.8, y: 1.2, w: 8, h: 1.2,
    fontFace: "Georgia", fontSize: 60, color: C.cream, bold: true,
    charSpacing: 4, margin: 0,
  });

  // Tagline
  s.addText("Your Menopause Companion", {
    x: 0.8, y: 2.3, w: 8, h: 0.6,
    fontFace: "Calibri", fontSize: 26, color: C.gold, margin: 0,
  });

  // Subtitle
  s.addText("Track symptoms. See patterns. Take control.", {
    x: 0.8, y: 3.1, w: 7, h: 0.5,
    fontFace: "Calibri", fontSize: 16, color: C.muted, italic: true, margin: 0,
  });

  // Bottom bar
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.1, w: 10, h: 0.525, fill: { color: C.sage, transparency: 70 } });
  s.addText("iOS App  •  Privacy-First  •  On-Device AI", {
    x: 0.8, y: 5.15, w: 8.4, h: 0.45,
    fontFace: "Calibri", fontSize: 12, color: C.cream, margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2: THE PROBLEM
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  // Section label
  s.addText("THE PROBLEM", {
    x: 0.8, y: 0.4, w: 3, h: 0.4,
    fontFace: "Calibri", fontSize: 12, color: C.clay, bold: true, charSpacing: 3, margin: 0,
  });

  // Title
  s.addText("Menopause affects every woman.\nAlmost no one is prepared.", {
    x: 0.8, y: 0.9, w: 8.4, h: 1.2,
    fontFace: "Georgia", fontSize: 30, color: C.cream, margin: 0,
  });

  // Stats row — 3 big numbers
  const stats = [
    { num: "1.1B", label: "Women in menopause\nworldwide by 2025", x: 0.8 },
    { num: "75%", label: "Experience symptoms that\ndisrupt daily life", x: 3.8 },
    { num: "73%", label: "Don't treat their\nmenopause symptoms", x: 6.8 },
  ];
  stats.forEach(({ num, label, x }) => {
    s.addShape(pres.shapes.RECTANGLE, { x, y: 2.4, w: 2.6, h: 1.8, fill: { color: C.cardBg }, shadow: cardShadow() });
    s.addText(num, { x, y: 2.5, w: 2.6, h: 0.9, fontFace: "Georgia", fontSize: 40, color: C.gold, bold: true, align: "center", margin: 0 });
    s.addText(label, { x, y: 3.35, w: 2.6, h: 0.8, fontFace: "Calibri", fontSize: 11, color: C.muted, align: "center", margin: 0 });
  });

  // Bottom insight
  s.addText("Women spend an average of 7+ years navigating perimenopause — often without a clear understanding of what's happening to their bodies.", {
    x: 0.8, y: 4.6, w: 8.4, h: 0.7,
    fontFace: "Calibri", fontSize: 13, color: C.sageLt, italic: true, margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3: THE SOLUTION
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addText("THE SOLUTION", {
    x: 0.8, y: 0.4, w: 3, h: 0.4,
    fontFace: "Calibri", fontSize: 12, color: C.clay, bold: true, charSpacing: 3, margin: 0,
  });

  s.addText("Vela turns daily symptoms into\nactionable health intelligence.", {
    x: 0.8, y: 0.9, w: 8.4, h: 1.1,
    fontFace: "Georgia", fontSize: 28, color: C.cream, margin: 0,
  });

  // Feature cards — 2x2 grid
  const features = [
    { icon: "⏱", title: "30-Second Daily Log", desc: "Tap to track mood, energy, and 44 menopause-specific symptoms. Faster than opening Notes.", x: 0.8, y: 2.3 },
    { icon: "🔍", title: "Pattern Detection", desc: "Automatic correlation analysis finds connections between triggers and symptoms you'd never spot alone.", x: 5.2, y: 2.3 },
    { icon: "📋", title: "Doctor-Ready Reports", desc: "Generate PDF reports with structured talking points. Turn 'I feel bad' into clinical data.", x: 0.8, y: 3.7 },
    { icon: "🤖", title: "AI Health Companion", desc: "Ask Vela about your patterns. On-device AI provides personalized, research-backed insights.", x: 5.2, y: 3.7 },
  ];

  features.forEach(({ icon, title, desc, x, y }) => {
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 4, h: 1.15, fill: { color: C.cardBg }, shadow: cardShadow() });
    // Left accent bar
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.06, h: 1.15, fill: { color: C.sage } });
    s.addText(icon, { x: x + 0.2, y: y + 0.12, w: 0.5, h: 0.5, fontSize: 22, margin: 0 });
    s.addText(title, { x: x + 0.7, y: y + 0.1, w: 3.1, h: 0.35, fontFace: "Georgia", fontSize: 14, color: C.cream, bold: true, margin: 0 });
    s.addText(desc, { x: x + 0.7, y: y + 0.45, w: 3.1, h: 0.6, fontFace: "Calibri", fontSize: 10.5, color: C.muted, margin: 0 });
  });

  s.addText("All data stored on-device. No cloud. No account required. Privacy is the default.", {
    x: 0.8, y: 5.05, w: 8.4, h: 0.4,
    fontFace: "Calibri", fontSize: 12, color: C.sage, margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4: KEY FEATURES DEEP DIVE
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addText("WHAT MAKES VELA DIFFERENT", {
    x: 0.8, y: 0.4, w: 5, h: 0.4,
    fontFace: "Calibri", fontSize: 12, color: C.clay, bold: true, charSpacing: 3, margin: 0,
  });

  s.addText("Built for menopause. Not adapted from a period tracker.", {
    x: 0.8, y: 0.9, w: 8.4, h: 0.7,
    fontFace: "Georgia", fontSize: 26, color: C.cream, margin: 0,
  });

  // Left column features
  const leftFeats = [
    { title: "44 Menopause-Specific Symptoms", desc: "Hot flashes, brain fog, joint pain, palpitations — organized by body system" },
    { title: "CBT-Based Programs", desc: "Evidence-based cognitive behavioral therapy for hot flashes, sleep, and anxiety" },
    { title: "Self-Experiments", desc: "16 structured experiments to test what actually helps YOU" },
    { title: "60 Daily Lessons", desc: "Evidence-based education delivered one insight at a time" },
  ];

  // Right column features
  const rightFeats = [
    { title: "Smart Weekly Digest", desc: "AI-generated summary with pattern spotlights and personalized tips" },
    { title: "Day-of-Week Analysis", desc: "Discover which days are your best and worst — and why" },
    { title: "Streak & Milestones", desc: "Habit formation mechanics keep you logging consistently" },
    { title: "Community Support", desc: "Safe, moderated space to share experiences (launching with user base)" },
  ];

  const drawList = (items, xBase) => {
    items.forEach((item, i) => {
      const y = 1.85 + i * 0.88;
      s.addShape(pres.shapes.OVAL, { x: xBase, y: y + 0.07, w: 0.22, h: 0.22, fill: { color: C.sage } });
      s.addText(item.title, { x: xBase + 0.38, y, w: 3.8, h: 0.3, fontFace: "Calibri", fontSize: 13, color: C.cream, bold: true, margin: 0 });
      s.addText(item.desc, { x: xBase + 0.38, y: y + 0.32, w: 3.8, h: 0.45, fontFace: "Calibri", fontSize: 10.5, color: C.muted, margin: 0 });
    });
  };

  drawList(leftFeats, 0.8);
  drawList(rightFeats, 5.2);
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5: COMPETITIVE LANDSCAPE
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addText("COMPETITIVE LANDSCAPE", {
    x: 0.8, y: 0.4, w: 5, h: 0.4,
    fontFace: "Calibri", fontSize: 12, color: C.clay, bold: true, charSpacing: 3, margin: 0,
  });

  s.addText("The only menopause app with on-device AI\nand doctor-ready reports.", {
    x: 0.8, y: 0.9, w: 8.4, h: 1, fontFace: "Georgia", fontSize: 26, color: C.cream, margin: 0,
  });

  // Comparison table
  const headers = [
    { text: "Feature", options: { bold: true, color: C.cream, fill: { color: C.sage }, fontFace: "Calibri", fontSize: 11, align: "left" } },
    { text: "Vela", options: { bold: true, color: C.dark, fill: { color: C.gold }, fontFace: "Calibri", fontSize: 11, align: "center" } },
    { text: "Midday", options: { bold: true, color: C.cream, fill: { color: C.sage }, fontFace: "Calibri", fontSize: 11, align: "center" } },
    { text: "Caria", options: { bold: true, color: C.cream, fill: { color: C.sage }, fontFace: "Calibri", fontSize: 11, align: "center" } },
    { text: "Balance", options: { bold: true, color: C.cream, fill: { color: C.sage }, fontFace: "Calibri", fontSize: 11, align: "center" } },
    { text: "Flo", options: { bold: true, color: C.cream, fill: { color: C.sage }, fontFace: "Calibri", fontSize: 11, align: "center" } },
  ];

  const cellOpt = (txt, isVela = false) => ({
    text: txt,
    options: {
      color: isVela ? C.gold : C.muted,
      fill: { color: C.cardBg },
      fontFace: "Calibri", fontSize: 10.5, align: isVela ? "center" : "center",
      bold: isVela,
    }
  });
  const labelOpt = (txt) => ({ text: txt, options: { color: C.cream, fill: { color: C.cardBg }, fontFace: "Calibri", fontSize: 10.5, align: "left" } });

  const rows = [
    [labelOpt("On-Device AI"), cellOpt("✓", true), cellOpt("✗"), cellOpt("✗"), cellOpt("✗"), cellOpt("✗")],
    [labelOpt("Doctor PDF Reports"), cellOpt("✓", true), cellOpt("✗"), cellOpt("✗"), cellOpt("✗"), cellOpt("✗")],
    [labelOpt("No Account Required"), cellOpt("✓", true), cellOpt("✗"), cellOpt("✗"), cellOpt("✗"), cellOpt("✗")],
    [labelOpt("Menopause-Specific"), cellOpt("✓", true), cellOpt("✓"), cellOpt("✓"), cellOpt("✓"), cellOpt("✗")],
    [labelOpt("CBT Programs"), cellOpt("✓", true), cellOpt("✓"), cellOpt("~"), cellOpt("✗"), cellOpt("✗")],
    [labelOpt("Pattern Detection"), cellOpt("✓", true), cellOpt("~"), cellOpt("~"), cellOpt("✗"), cellOpt("✗")],
    [labelOpt("Community"), cellOpt("✓", true), cellOpt("✓"), cellOpt("✓"), cellOpt("✗"), cellOpt("✓")],
    [labelOpt("Price/Year"), cellOpt("$49.99", true), cellOpt("B2B"), cellOpt("$59.99"), cellOpt("$49.99"), cellOpt("$49.99")],
  ];

  s.addTable([headers, ...rows], {
    x: 0.5, y: 2.1, w: 9, colW: [2, 1.2, 1.2, 1.2, 1.2, 1.2],
    border: { pt: 0.5, color: "3A3A55" },
    rowH: [0.38, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35, 0.35],
  });

  s.addText("Our wedge: On-device privacy + doctor-ready reports + AI pattern analysis = the only menopause app that makes you your own best advocate.", {
    x: 0.8, y: 5.0, w: 8.4, h: 0.45,
    fontFace: "Calibri", fontSize: 11, color: C.sage, italic: true, margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6: BUSINESS MODEL
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addText("BUSINESS MODEL", {
    x: 0.8, y: 0.4, w: 4, h: 0.4,
    fontFace: "Calibri", fontSize: 12, color: C.clay, bold: true, charSpacing: 3, margin: 0,
  });

  s.addText("Freemium with 7-day trial. Premium unlocks AI.", {
    x: 0.8, y: 0.9, w: 8.4, h: 0.7,
    fontFace: "Georgia", fontSize: 26, color: C.cream, margin: 0,
  });

  // Free vs Premium comparison
  // Free card
  s.addShape(pres.shapes.RECTANGLE, { x: 0.8, y: 1.8, w: 4, h: 3.0, fill: { color: C.cardBg }, shadow: cardShadow() });
  s.addText("Free", { x: 0.8, y: 1.9, w: 4, h: 0.5, fontFace: "Georgia", fontSize: 22, color: C.cream, align: "center", margin: 0 });
  s.addText("Forever", { x: 0.8, y: 2.3, w: 4, h: 0.35, fontFace: "Calibri", fontSize: 14, color: C.muted, align: "center", margin: 0 });
  s.addShape(pres.shapes.LINE, { x: 1.3, y: 2.72, w: 3, h: 0, line: { color: "3A3A55", width: 1 } });

  const freeFeatures = [
    "Daily symptom logging",
    "Basic pattern insights",
    "Day-of-week analysis",
    "Daily educational tips",
    "Streak tracking",
  ];
  s.addText(freeFeatures.map((f, i) => ({
    text: `✓  ${f}`,
    options: { breakLine: i < freeFeatures.length - 1, color: C.muted, fontSize: 12, fontFace: "Calibri" },
  })), { x: 1.3, y: 2.85, w: 3.2, h: 1.8, paraSpaceAfter: 6 });

  // Premium card
  s.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 1.8, w: 4, h: 3.0, fill: { color: C.cardBg }, shadow: cardShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 1.8, w: 4, h: 0.06, fill: { color: C.gold } }); // gold top accent
  s.addText("Premium", { x: 5.2, y: 1.9, w: 4, h: 0.5, fontFace: "Georgia", fontSize: 22, color: C.gold, align: "center", margin: 0 });
  s.addText("$49.99/yr  or  $5.99/mo", { x: 5.2, y: 2.3, w: 4, h: 0.35, fontFace: "Calibri", fontSize: 14, color: C.cream, align: "center", margin: 0 });
  s.addShape(pres.shapes.LINE, { x: 5.7, y: 2.72, w: 3, h: 0, line: { color: "3A3A55", width: 1 } });

  const premiumFeatures = [
    "Everything in Free, plus:",
    "Ask Vela AI companion",
    "Smart weekly digest",
    "Doctor visit PDF reports",
    "Deep trend analysis",
    "CBT programs",
  ];
  s.addText(premiumFeatures.map((f, i) => ({
    text: `${i === 0 ? "   " : "✓  "}${f}`,
    options: { breakLine: i < premiumFeatures.length - 1, color: i === 0 ? C.sage : C.cream, fontSize: 12, fontFace: "Calibri", italic: i === 0 },
  })), { x: 5.7, y: 2.85, w: 3.2, h: 1.8, paraSpaceAfter: 4 });

  // Revenue note
  s.addText("7-day free trial  →  ~55% trial-to-paid conversion (health app benchmark)", {
    x: 0.8, y: 5.05, w: 8.4, h: 0.4,
    fontFace: "Calibri", fontSize: 12, color: C.muted, margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7: MARKET & FINANCIALS
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addText("MARKET & FINANCIALS", {
    x: 0.8, y: 0.4, w: 5, h: 0.4,
    fontFace: "Calibri", fontSize: 12, color: C.clay, bold: true, charSpacing: 3, margin: 0,
  });

  s.addText("Large addressable market. Lean cost structure.", {
    x: 0.8, y: 0.9, w: 8.4, h: 0.7,
    fontFace: "Georgia", fontSize: 26, color: C.cream, margin: 0,
  });

  // TAM/SAM/SOM
  s.addShape(pres.shapes.RECTANGLE, { x: 0.8, y: 1.8, w: 2.7, h: 1.5, fill: { color: C.cardBg }, shadow: cardShadow() });
  s.addText("TAM", { x: 0.8, y: 1.9, w: 2.7, h: 0.3, fontFace: "Calibri", fontSize: 11, color: C.sage, align: "center", bold: true, margin: 0 });
  s.addText("$1.8B", { x: 0.8, y: 2.2, w: 2.7, h: 0.5, fontFace: "Georgia", fontSize: 32, color: C.gold, align: "center", bold: true, margin: 0 });
  s.addText("FemTech health apps\nglobal market (2025)", { x: 0.8, y: 2.7, w: 2.7, h: 0.5, fontFace: "Calibri", fontSize: 10, color: C.muted, align: "center", margin: 0 });

  s.addShape(pres.shapes.RECTANGLE, { x: 3.65, y: 1.8, w: 2.7, h: 1.5, fill: { color: C.cardBg }, shadow: cardShadow() });
  s.addText("SAM", { x: 3.65, y: 1.9, w: 2.7, h: 0.3, fontFace: "Calibri", fontSize: 11, color: C.sage, align: "center", bold: true, margin: 0 });
  s.addText("$240M", { x: 3.65, y: 2.2, w: 2.7, h: 0.5, fontFace: "Georgia", fontSize: 32, color: C.gold, align: "center", bold: true, margin: 0 });
  s.addText("English-speaking menopause\napp market (US, UK, CA, AU)", { x: 3.65, y: 2.7, w: 2.7, h: 0.5, fontFace: "Calibri", fontSize: 10, color: C.muted, align: "center", margin: 0 });

  s.addShape(pres.shapes.RECTANGLE, { x: 6.5, y: 1.8, w: 2.7, h: 1.5, fill: { color: C.cardBg }, shadow: cardShadow() });
  s.addText("SOM", { x: 6.5, y: 1.9, w: 2.7, h: 0.3, fontFace: "Calibri", fontSize: 11, color: C.sage, align: "center", bold: true, margin: 0 });
  s.addText("$500K", { x: 6.5, y: 2.2, w: 2.7, h: 0.5, fontFace: "Georgia", fontSize: 32, color: C.gold, align: "center", bold: true, margin: 0 });
  s.addText("Year 2 target\n1,000 paid subscribers", { x: 6.5, y: 2.7, w: 2.7, h: 0.5, fontFace: "Calibri", fontSize: 10, color: C.muted, align: "center", margin: 0 });

  // Unit Economics
  s.addShape(pres.shapes.RECTANGLE, { x: 0.8, y: 3.6, w: 4, h: 1.7, fill: { color: C.cardBg }, shadow: cardShadow() });
  s.addText("Unit Economics", { x: 0.8, y: 3.7, w: 4, h: 0.35, fontFace: "Georgia", fontSize: 16, color: C.cream, align: "center", margin: 0 });
  s.addText([
    { text: "Blended ARPU:  ", options: { color: C.muted, fontSize: 12, fontFace: "Calibri", breakLine: true } },
    { text: "$39.60/yr net (after Apple's 30%)", options: { color: C.cream, fontSize: 12, fontFace: "Calibri", breakLine: true } },
    { text: "\nCustomer LTV:  ", options: { color: C.muted, fontSize: 12, fontFace: "Calibri", breakLine: true } },
    { text: "$36–48 (8–14 month avg lifespan)", options: { color: C.cream, fontSize: 12, fontFace: "Calibri", breakLine: true } },
    { text: "\nPlan mix:  ", options: { color: C.muted, fontSize: 12, fontFace: "Calibri", breakLine: true } },
    { text: "70% annual / 30% monthly", options: { color: C.cream, fontSize: 12, fontFace: "Calibri" } },
  ], { x: 1.1, y: 4.1, w: 3.5, h: 1.1, margin: 0 });

  // Revenue Scenarios
  s.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 3.6, w: 4, h: 1.7, fill: { color: C.cardBg }, shadow: cardShadow() });
  s.addText("Year 1 Revenue Scenarios", { x: 5.2, y: 3.7, w: 4, h: 0.35, fontFace: "Georgia", fontSize: 16, color: C.cream, align: "center", margin: 0 });
  s.addText([
    { text: "Organic only:  ", options: { color: C.muted, fontSize: 12, fontFace: "Calibri", breakLine: true } },
    { text: "~$5,400", options: { color: C.sageLt, fontSize: 12, fontFace: "Calibri", breakLine: true } },
    { text: "\nModest ads ($500/mo):  ", options: { color: C.muted, fontSize: 12, fontFace: "Calibri", breakLine: true } },
    { text: "~$12,000 (2.0x ROAS)", options: { color: C.gold, fontSize: 12, fontFace: "Calibri", breakLine: true } },
    { text: "\nGrowth mode ($2K/mo):  ", options: { color: C.muted, fontSize: 12, fontFace: "Calibri", breakLine: true } },
    { text: "~$28,000 (1.17x ROAS)", options: { color: C.clay, fontSize: 12, fontFace: "Calibri" } },
  ], { x: 5.5, y: 4.1, w: 3.5, h: 1.1, margin: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8: GO-TO-MARKET
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addText("GO-TO-MARKET STRATEGY", {
    x: 0.8, y: 0.4, w: 5, h: 0.4,
    fontFace: "Calibri", fontSize: 12, color: C.clay, bold: true, charSpacing: 3, margin: 0,
  });

  s.addText("Organic-first. Community-driven growth.", {
    x: 0.8, y: 0.9, w: 8.4, h: 0.7,
    fontFace: "Georgia", fontSize: 26, color: C.cream, margin: 0,
  });

  // Timeline
  const phases = [
    {
      phase: "PHASE 1", title: "Foundation", timeline: "Months 1–3",
      items: ["App Store Optimization (ASO)", "Social proof: first 50 reviews", "Reddit & Facebook menopause communities", "Content marketing: symptom education"],
      color: C.sage,
    },
    {
      phase: "PHASE 2", title: "Growth", timeline: "Months 4–6",
      items: ["Apple Search Ads ($500/mo)", "Instagram/Facebook targeting 45-55", "Menopause influencer partnerships", "Referral program launch"],
      color: C.gold,
    },
    {
      phase: "PHASE 3", title: "Scale", timeline: "Months 7–12",
      items: ["Increase ad budget to $2K/mo", "Healthcare provider partnerships", "In-app community launch", "PR: women's health publications"],
      color: C.clay,
    },
  ];

  phases.forEach(({ phase, title, timeline, items, color }, i) => {
    const x = 0.8 + i * 3.05;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.8, w: 2.8, h: 3.2, fill: { color: C.cardBg }, shadow: cardShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y: 1.8, w: 2.8, h: 0.06, fill: { color } });
    s.addText(phase, { x, y: 1.95, w: 2.8, h: 0.3, fontFace: "Calibri", fontSize: 10, color, align: "center", bold: true, charSpacing: 2, margin: 0 });
    s.addText(title, { x, y: 2.25, w: 2.8, h: 0.35, fontFace: "Georgia", fontSize: 16, color: C.cream, align: "center", margin: 0 });
    s.addText(timeline, { x, y: 2.55, w: 2.8, h: 0.25, fontFace: "Calibri", fontSize: 10, color: C.muted, align: "center", margin: 0 });
    s.addShape(pres.shapes.LINE, { x: x + 0.4, y: 2.9, w: 2, h: 0, line: { color: "3A3A55", width: 0.5 } });

    s.addText(items.map((item, j) => ({
      text: `▸  ${item}`,
      options: { breakLine: j < items.length - 1, color: C.muted, fontSize: 10.5, fontFace: "Calibri" },
    })), { x: x + 0.25, y: 3.05, w: 2.3, h: 1.8, paraSpaceAfter: 5 });
  });

  // Milestone bar
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.1, w: 10, h: 0.525, fill: { color: C.sage, transparency: 80 } });
  s.addText("Target: 500 active users by Month 4  •  $500 MRR by Month 6  •  1,000 paid subscribers by Month 12", {
    x: 0.5, y: 5.15, w: 9, h: 0.45,
    fontFace: "Calibri", fontSize: 11, color: C.cream, align: "center", margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9: TRACTION & STATUS
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addText("WHERE WE STAND", {
    x: 0.8, y: 0.4, w: 4, h: 0.4,
    fontFace: "Calibri", fontSize: 12, color: C.clay, bold: true, charSpacing: 3, margin: 0,
  });

  s.addText("Product complete. Ready for App Store.", {
    x: 0.8, y: 0.9, w: 8.4, h: 0.7,
    fontFace: "Georgia", fontSize: 26, color: C.cream, margin: 0,
  });

  // Status items
  const done = [
    "Full React app — 7,800+ lines of production code",
    "44 symptoms, 6 triggers, mood & energy tracking",
    "AI health companion with research-backed knowledge",
    "Doctor-ready PDF report generation",
    "CBT programs, self-experiments, 60 daily lessons",
    "Community system with Firebase backend (ready to activate)",
    "Smart weekly digest with pattern analysis",
    "Content moderation & safety systems",
  ];

  const next = [
    "Apple Developer account & Capacitor iOS build",
    "RevenueCat subscription integration",
    "App Store submission & review",
    "Seed community with beta testers",
  ];

  // Done column
  s.addShape(pres.shapes.RECTANGLE, { x: 0.8, y: 1.75, w: 5.2, h: 3.3, fill: { color: C.cardBg }, shadow: cardShadow() });
  s.addText("✓ BUILT", { x: 0.8, y: 1.85, w: 5.2, h: 0.35, fontFace: "Calibri", fontSize: 12, color: C.sage, align: "center", bold: true, charSpacing: 2, margin: 0 });
  s.addShape(pres.shapes.LINE, { x: 1.3, y: 2.25, w: 4.2, h: 0, line: { color: "3A3A55", width: 0.5 } });
  s.addText(done.map((item, i) => ({
    text: `✓  ${item}`,
    options: { breakLine: i < done.length - 1, color: C.cream, fontSize: 11, fontFace: "Calibri" },
  })), { x: 1.1, y: 2.35, w: 4.7, h: 2.5, paraSpaceAfter: 5 });

  // Next column
  s.addShape(pres.shapes.RECTANGLE, { x: 6.3, y: 1.75, w: 3, h: 3.3, fill: { color: C.cardBg }, shadow: cardShadow() });
  s.addText("→ NEXT", { x: 6.3, y: 1.85, w: 3, h: 0.35, fontFace: "Calibri", fontSize: 12, color: C.gold, align: "center", bold: true, charSpacing: 2, margin: 0 });
  s.addShape(pres.shapes.LINE, { x: 6.7, y: 2.25, w: 2.2, h: 0, line: { color: "3A3A55", width: 0.5 } });
  s.addText(next.map((item, i) => ({
    text: `▸  ${item}`,
    options: { breakLine: i < next.length - 1, color: C.muted, fontSize: 11, fontFace: "Calibri" },
  })), { x: 6.5, y: 2.35, w: 2.6, h: 2.5, paraSpaceAfter: 5 });

  // Cost structure
  s.addShape(pres.shapes.RECTANGLE, { x: 0.8, y: 5.15, w: 8.4, h: 0.35, fill: { color: C.sage, transparency: 85 } });
  s.addText("Fixed costs: ~$10/month  •  Break-even: 4 annual subscribers  •  Bootstrapped — no funding required to launch", {
    x: 0.8, y: 5.15, w: 8.4, h: 0.35,
    fontFace: "Calibri", fontSize: 11, color: C.cream, align: "center", margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10: CLOSING / VISION
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  // Decorative shapes
  s.addShape(pres.shapes.OVAL, { x: -1, y: -1, w: 3.5, h: 3.5, fill: { color: C.sage, transparency: 88 } });
  s.addShape(pres.shapes.OVAL, { x: 7.5, y: 3, w: 4, h: 4, fill: { color: C.clay, transparency: 88 } });

  s.addText("Vela", {
    x: 0.8, y: 1.0, w: 8.4, h: 1,
    fontFace: "Georgia", fontSize: 52, color: C.cream, align: "center", bold: true, charSpacing: 4, margin: 0,
  });

  s.addText("Helping women understand their bodies\nduring the most under-supported health\ntransition of their lives.", {
    x: 1.5, y: 2.1, w: 7, h: 1.3,
    fontFace: "Georgia", fontSize: 22, color: C.gold, align: "center", margin: 0,
  });

  s.addShape(pres.shapes.LINE, { x: 4, y: 3.6, w: 2, h: 0, line: { color: C.sage, width: 1.5 } });

  s.addText("Your data. Your device. Your advocate.", {
    x: 1.5, y: 3.85, w: 7, h: 0.5,
    fontFace: "Calibri", fontSize: 18, color: C.cream, align: "center", italic: true, margin: 0,
  });

  // Contact / CTA
  s.addText("Let's talk about what's next.", {
    x: 1.5, y: 4.6, w: 7, h: 0.5,
    fontFace: "Calibri", fontSize: 14, color: C.muted, align: "center", margin: 0,
  });
}

// ─── GENERATE FILE ─────────────────────────────────────────────────────────
const outputPath = "/Users/kristopher/Vela/Vela-Pitch-Deck.pptx";
pres.writeFile({ fileName: outputPath }).then(() => {
  console.log("✓ Pitch deck saved to: " + outputPath);
}).catch(err => {
  console.error("Error:", err);
});
