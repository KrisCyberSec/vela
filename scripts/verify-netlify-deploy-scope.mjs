import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredIgnoreRules = [
  "*",
  "!netlify.toml",
  "!package.json",
  "!package-lock.json",
  "!landing/",
  "!landing/**",
  "!netlify/",
  "!netlify/functions/",
  "!netlify/functions/**",
];

const forbiddenAllowPrefixes = [
  "!build",
  "!ios",
  "!public",
  "!screenshots",
  "!src",
];

const requiredDeployPaths = [
  "netlify.toml",
  "package.json",
  "package-lock.json",
  "landing/index.html",
  "landing/privacy.html",
  "landing/terms.html",
  "landing/support.html",
  "netlify/functions/ask-vela.js",
  "netlify/functions/daily-brief.js",
  "netlify/functions/health.js",
  "netlify/functions/waitlist.js",
  "netlify/functions/waitlist-export.js",
];

const forbiddenDeployPrefixes = [
  "build/",
  "ios/",
  "public/",
  "screenshots/",
  "src/",
];

function fail(message) {
  console.error(`Netlify deploy scope check failed: ${message}`);
  process.exitCode = 1;
}

function readNetlifyIgnore() {
  const file = path.join(root, ".netlifyignore");
  if (!fs.existsSync(file)) {
    fail(".netlifyignore is missing");
    return [];
  }
  return fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function walk(relativePath, files = []) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return files;
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    files.push(relativePath.replaceAll(path.sep, "/"));
    return files;
  }
  for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
    walk(path.join(relativePath, entry.name), files);
  }
  return files;
}

const ignoreRules = readNetlifyIgnore();

for (const rule of requiredIgnoreRules) {
  if (!ignoreRules.includes(rule)) {
    fail(`.netlifyignore must include ${rule}`);
  }
}

if (ignoreRules[0] !== "*") {
  fail(".netlifyignore must deny all files before allowlisting deploy paths");
}

for (const rule of ignoreRules) {
  if (!rule.startsWith("!")) continue;
  if (forbiddenAllowPrefixes.some((prefix) => rule === prefix || rule.startsWith(`${prefix}/`))) {
    fail(`.netlifyignore must not allow ${rule}`);
  }
}

for (const deployPath of requiredDeployPaths) {
  if (!fs.existsSync(path.join(root, deployPath))) {
    fail(`required deploy path is missing: ${deployPath}`);
  }
}

const deployManifest = [
  "netlify.toml",
  "package.json",
  "package-lock.json",
  ...walk("landing"),
  ...walk("netlify/functions"),
].sort();

for (const file of deployManifest) {
  if (forbiddenDeployPrefixes.some((prefix) => file.startsWith(prefix))) {
    fail(`deploy manifest unexpectedly includes ${file}`);
  }
}

if (!process.exitCode) {
  console.log(`Netlify deploy scope OK: ${deployManifest.length} files limited to landing/ and netlify/functions/.`);
}
