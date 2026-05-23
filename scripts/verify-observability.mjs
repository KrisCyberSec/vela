import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");

function readEnv(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return null;
  const env = {};
  for (const raw of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, files);
    else if (/\.(js|html|css|json)$/.test(ent.name)) files.push(full);
  }
  return files;
}

function hasValue(env, key) {
  return !!(env && typeof env[key] === "string" && env[key].trim());
}

function printStatus(label, ok, detail) {
  const mark = ok ? "OK" : "MISSING";
  console.log(`${mark.padEnd(8)} ${label}${detail ? ` - ${detail}` : ""}`);
}

const env = readEnv(".env.local") || {};
const requiredClient = [
  ["PostHog project key", "REACT_APP_POSTHOG_KEY", /^phc_/],
  ["Sentry DSN", "REACT_APP_SENTRY_DSN", /^https:\/\/.+@.+sentry\.io\/\d+/],
  ["RevenueCat iOS public key", "REACT_APP_REVENUECAT_IOS_API_KEY", /^appl_/],
];

const missing = [];
console.log("Local client env");
for (const [label, key, pattern] of requiredClient) {
  const ok = hasValue(env, key) && pattern.test(env[key]);
  printStatus(label, ok, key);
  if (!ok) missing.push(key);
}

const buildFiles = walk(path.join(root, "build"));
if (buildFiles.length) {
  const buildText = buildFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  console.log("\nCurrent build bundle");
  printStatus("PostHog key embedded", /phc_[A-Za-z0-9_]+/.test(buildText), "expected for app analytics");
  printStatus("Sentry DSN embedded", /https:\/\/[^\s"']+@[^\s"']*sentry\.io\/\d+/.test(buildText), "required for crash reporting");
  printStatus("RevenueCat key embedded", /appl_[A-Za-z0-9_]+/.test(buildText), "required for native purchases");
} else {
  console.log("\nCurrent build bundle");
  console.log("SKIPPED  build/ does not exist yet. Run `npm run build` after setting keys.");
}

console.log("\nServer-side production check");
console.log("MANUAL   Verify Netlify env contains ANTHROPIC_API_KEY, REVENUECAT_REST_KEY, and NETLIFY_BLOBS_TOKEN.");

if (missing.length) {
  console.log(`\nLaunch blockers: ${missing.join(", ")}`);
  if (strict) process.exitCode = 1;
} else {
  console.log("\nLocal client observability env is present. Rebuild, sync iOS, then verify dashboards.");
}
