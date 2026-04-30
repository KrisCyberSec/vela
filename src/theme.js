/**
 * Theme management — applies data-theme="dark"/"light" to <html> based on
 * the user's saved preference (light/dark/system). When pref is "system",
 * watches the OS preference via matchMedia and updates live.
 *
 * Storage key: vela_theme_pref. Values: "light" | "dark" | "system".
 * Default: "system" (matches the prior behavior of @media-only theming).
 *
 * initTheme() must run BEFORE React mounts to avoid a flash of wrong theme
 * (called from src/index.js).
 */

const STORAGE_KEY = "vela_theme_pref";
export const VALID_THEMES = ["light", "dark", "system"];

let mqListener = null;

function getSystemPref() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light"; // fallback for environments without matchMedia
  }
}

function readPref() {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return VALID_THEMES.includes(v) ? v : "system";
  } catch {
    return "system";
  }
}

function applyAttribute(effective) {
  try {
    document.documentElement.setAttribute("data-theme", effective);
  } catch {
    // ignore — happens in non-browser contexts
  }
}

function detachSystemListener() {
  if (!mqListener) return;
  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.removeEventListener) mq.removeEventListener("change", mqListener);
    else if (mq.removeListener) mq.removeListener(mqListener); // Safari < 14
  } catch { /* ignore */ }
  mqListener = null;
}

function attachSystemListener() {
  detachSystemListener();
  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mqListener = (e) => applyAttribute(e.matches ? "dark" : "light");
    if (mq.addEventListener) mq.addEventListener("change", mqListener);
    else if (mq.addListener) mq.addListener(mqListener); // Safari < 14
  } catch { /* ignore */ }
}

/**
 * Apply a theme preference. Persists to localStorage and updates the DOM.
 * Returns the effective theme that was applied ("light" or "dark").
 */
export function setTheme(pref) {
  if (!VALID_THEMES.includes(pref)) pref = "system";
  try { window.localStorage.setItem(STORAGE_KEY, pref); } catch { /* ignore */ }
  if (pref === "system") {
    attachSystemListener();
    const effective = getSystemPref();
    applyAttribute(effective);
    return effective;
  }
  detachSystemListener();
  applyAttribute(pref);
  return pref;
}

/**
 * Read the current preference (one of "light"/"dark"/"system").
 * Different from the *effective* applied theme — useful for the Settings UI.
 */
export function getThemePref() {
  return readPref();
}

/**
 * Initialize theme on app start. Idempotent — safe to call multiple times.
 */
export function initTheme() {
  setTheme(readPref());
}
