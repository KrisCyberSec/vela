// Netlify Function: founder-hub aggregated data (waitlist + curated metadata).
// Auth: `Authorization: Bearer <ADMIN_TOKEN>`.
//
// Most data is computed live (waitlist from Blobs). The static curated parts
// (services, docs, punchlist, money) live as constants below — edit and
// redeploy to update.

const { getStore } = require("@netlify/blobs");

const SITE_ID = "e0a6111f-d0ad-469a-bb29-66844eb342fe";
const DAY_MS = 86400000;

const SERVICES = [
  { key: "netlify",    name: "Netlify",            subtitle: "Landing + functions + blobs",  url: "https://app.netlify.com/projects/velahealth-app",       accent: "#00C7B7" },
  { key: "namecheap",  name: "Namecheap",          subtitle: "velahealth.health domain",     url: "https://ap.www.namecheap.com/domains/list/",            accent: "#DE3723" },
  { key: "github",     name: "GitHub",             subtitle: "kriscybersec/vela",            url: "https://github.com/kriscybersec/vela",                  accent: "#181717" },
  { key: "appstore",   name: "App Store Connect",  subtitle: "iOS submission",               url: "https://appstoreconnect.apple.com",                     accent: "#0072F5" },
  { key: "appledev",   name: "Apple Developer",    subtitle: "Certificates + capabilities",  url: "https://developer.apple.com/account",                   accent: "#000000" },
  { key: "revenuecat", name: "RevenueCat",         subtitle: "Subscriptions",                url: "https://app.revenuecat.com",                            accent: "#F5567B" },
  { key: "anthropic",  name: "Anthropic Console",  subtitle: "Ask Vela + Daily Brief",       url: "https://console.anthropic.com",                         accent: "#D97757" },
  { key: "posthog",    name: "PostHog",            subtitle: "Product analytics",            url: "https://app.posthog.com",                               accent: "#1D4AFF" },
  { key: "sentry",     name: "Sentry",             subtitle: "Error reporting",              url: "https://sentry.io",                                     accent: "#362D59" },
  { key: "firebase",   name: "Firebase",           subtitle: "Community backend (dormant)",  url: "https://console.firebase.google.com",                   accent: "#F58220" },
  { key: "site",       name: "velahealth.health",  subtitle: "Production landing",            url: "https://velahealth.health",                             accent: "#7A9E87" },
];

const DOCS = [
  {
    group: "Product",
    items: [
      { title: "Overview",                desc: "What Vela is, where it stands",  path: "docs/product/overview.md" },
      { title: "App Store listing",       desc: "Copy + screenshots brief",       path: "docs/product/app-store-listing.md" },
      { title: "Launch strategy",         desc: "Go-to-market plan",              path: "docs/product/launch-strategy.md" },
      { title: "Community outreach",      desc: "Pre-written posts",              path: "docs/product/community-outreach-drafts.md" },
    ],
  },
  {
    group: "Engineering",
    items: [
      { title: "Architecture",            desc: "Codebase navigation",            path: "docs/engineering/architecture.md" },
      { title: "AI companion",            desc: "Ask Vela internals",             path: "docs/engineering/ai-companion.md" },
      { title: "Design system",           desc: "Tokens + components",            path: "docs/engineering/design-system.md" },
      { title: "Community (Firebase)",    desc: "Dormant backend",                path: "docs/engineering/community-firebase.md" },
    ],
  },
  {
    group: "Operations",
    items: [
      { title: "Manual tasks",            desc: "What's blocking launch",         path: "docs/operations/manual-tasks.md", primary: true },
      { title: "App Store submission",    desc: "Step-by-step checklist",         path: "docs/operations/app-store-submission.md" },
      { title: "iOS build",               desc: "Capacitor + Xcode",              path: "docs/operations/ios-build.md" },
      { title: "Deployment",              desc: "Landing deploy guide",           path: "docs/operations/deployment.md" },
      { title: "Infrastructure",          desc: "Every service we use",           path: "docs/operations/infrastructure.md" },
      { title: "Waitlist",                desc: "Admin + token rotation",         path: "docs/operations/waitlist.md" },
      { title: "Analytics + billing",     desc: "Setup keys",                     path: "docs/operations/analytics-and-billing.md" },
      { title: "Security audit",          desc: "April 2026 findings",            path: "docs/operations/security-audit-2026-04.md" },
    ],
  },
  {
    group: "Business",
    items: [
      { title: "Financial model",         desc: "Pricing + projections",          path: "docs/business/financial-model.md" },
      { title: "Pitch deck",              desc: "Investor narrative",             path: "docs/business/pitch-deck.md" },
    ],
  },
];

const PUNCHLIST = [
  {
    group: "Blocking App Store submission",
    weight: "critical",
    tasks: [
      "Apple Developer Program enrollment ($99/yr)",
      "Create the App in App Store Connect",
      "Create the two IAP products (annual + monthly)",
      "Enable HealthKit capability in Xcode",
    ],
  },
  {
    group: "Blocking Ask Vela + Daily Brief in production",
    weight: "high",
    tasks: [
      "Set ANTHROPIC_API_KEY in Netlify",
      "Set REVENUECAT_REST_KEY in Netlify",
      "(Optional) Tune ASK_VELA_DAILY_USD",
    ],
  },
  {
    group: "Blocking RevenueCat purchases",
    weight: "high",
    tasks: ["Wire RevenueCat after IAP products exist"],
  },
  {
    group: "Blocking analytics wire-up",
    weight: "medium",
    tasks: [
      "Create PostHog account + paste public key",
      "Create Sentry account + paste DSN",
    ],
  },
  {
    group: "Lower priority",
    weight: "low",
    tasks: [
      "Apple Search Ads account (post-launch)",
      "App Store screenshots (when ready to submit)",
    ],
  },
];

const MONEY = {
  prices: [
    { name: "Premium annual",  value: "$69.99/yr", note: "14-day free trial" },
    { name: "Premium monthly", value: "$8.99/mo",  note: "14-day free trial" },
    { name: "Free tier",       value: "$0",        note: "Core tracking forever" },
  ],
  fixedMonthly: [
    { name: "Netlify",         value: "$0" },
    { name: "Namecheap domain",value: "~$1" },
    { name: "Apple Developer", value: "~$8" },
    { name: "RevenueCat",      value: "$0",  note: "until $10K MTR" },
  ],
};

exports.handler = async (event) => {
  const auth = event.headers?.authorization || event.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  const token = match?.[1]?.trim();
  if (!token || !process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  try {
    const store = getStore({
      name: "waitlist",
      siteID: SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN,
    });

    const { blobs } = await store.list();
    const entries = (await Promise.all(
      blobs.map(async (b) => await store.get(b.key, { type: "json" }))
    )).filter(Boolean);

    entries.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));

    const now = Date.now();
    const last24h = entries.filter((e) => new Date(e.submittedAt) > now - DAY_MS).length;
    const last7d  = entries.filter((e) => new Date(e.submittedAt) > now - 7 * DAY_MS).length;
    const last30d = entries.filter((e) => new Date(e.submittedAt) > now - 30 * DAY_MS).length;

    // Sparkline: signups per day for last 30 days, oldest -> newest
    const sparkline = Array(30).fill(0);
    for (const e of entries) {
      const t = new Date(e.submittedAt).getTime();
      if (!t || isNaN(t)) continue;
      const daysAgo = Math.floor((now - t) / DAY_MS);
      if (daysAgo >= 0 && daysAgo < 30) sparkline[29 - daysAgo]++;
    }

    // Top referrers (host-only)
    const refCounts = {};
    for (const e of entries) {
      const raw = e.referrer || "";
      let host = "direct";
      if (raw) {
        try { host = new URL(raw).hostname.replace(/^www\./, ""); }
        catch { host = "direct"; }
      }
      refCounts[host] = (refCounts[host] || 0) + 1;
    }
    const topReferrers = Object.entries(refCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([host, count]) => ({ host, count }));

    const recent = entries.slice(0, 20).map((e) => ({
      email: e.email,
      submittedAt: e.submittedAt,
      referrer: e.referrer || null,
    }));

    const body = {
      generatedAt: new Date().toISOString(),
      waitlist: {
        total: entries.length,
        last24h,
        last7d,
        last30d,
        sparkline,
        topReferrers,
        recent,
      },
      services: SERVICES,
      docs: DOCS,
      punchlist: PUNCHLIST,
      money: MONEY,
      repo: {
        name: "kriscybersec/vela",
        deployRef: process.env.COMMIT_REF || null,
        deployBranch: process.env.BRANCH || null,
        deployedAt: process.env.DEPLOY_PRIME_URL ? new Date().toISOString() : null,
      },
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Hub data failed", detail: String(err?.message || err) }),
    };
  }
};
