/**
 * Safe localStorage wrappers.
 *
 * Native iOS Capacitor: localStorage is reliable, so these helpers are no-overhead.
 * Web preview / Safari private mode / a tester opening the cloudflare URL in a private
 * tab: localStorage can throw on read or write. Without this helper, an exception in
 * any useState initializer would white-screen the app before the ErrorBoundary kicks in.
 *
 * For new code, prefer these helpers for any localStorage access. For existing code
 * (~116 call sites in App.jsx), the top-level ErrorBoundary in src/App.jsx is the
 * primary safety net — these helpers are belt-and-suspenders for the App-init reads.
 */

export function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
