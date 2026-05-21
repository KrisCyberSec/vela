/**
 * Error reporting — Sentry. No-ops without a DSN, so local dev stays quiet.
 * Init must run before React mounts; called from src/index.js.
 *
 * Coverage layers (in order of how the error reaches Sentry):
 *   1. ErrorBoundary catches React render errors -> reportError()
 *   2. window 'error' handler catches uncaught synchronous throws
 *   3. window 'unhandledrejection' handler catches unawaited Promise
 *      rejections (most common: forgot to .catch a fetch())
 *   4. Manual reportError(err, { tag }) calls at known error sinks
 *      (subscription.js, ask-vela fetch, daily-brief fetch, etc.)
 *
 * User context: identifyUser(appUserId) sets a non-PII identifier on the
 * Sentry scope so errors group by user. We never send the email or any
 * health data — just the anonymous RevenueCat appUserId.
 *
 * Release tagging: each event is tagged with the package.json version
 * so we can see "this error appeared in v0.1.0" in the Sentry dashboard.
 */

import * as Sentry from '@sentry/react';
import pkg from '../package.json';

const DSN = process.env.REACT_APP_SENTRY_DSN || '';
const ENV = process.env.NODE_ENV || 'development';
const RELEASE = `vela@${pkg.version}`;

let initialized = false;

export function initErrorReporting() {
  if (!DSN || initialized) return;
  Sentry.init({
    dsn: DSN,
    environment: ENV,
    release: RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.headers;
        delete event.request.cookies;
        delete event.request.query_string;
      }
      if (Array.isArray(event.breadcrumbs)) {
        event.breadcrumbs = event.breadcrumbs.map((crumb) => {
          if (crumb.category === "console" && typeof crumb.message === "string") {
            return { ...crumb, message: crumb.message.slice(0, 240) };
          }
          return crumb;
        });
      }
      return event;
    },
  });
  initialized = true;

  // Catch uncaught synchronous errors not inside a React render
  // (e.g. event handlers, setTimeout callbacks, raw script).
  window.addEventListener('error', (e) => {
    if (!e?.error) return;
    try {
      Sentry.captureException(e.error, { extra: { tag: 'window_error', filename: e.filename, line: e.lineno } });
    } catch { /* never let reporting break the app */ }
  });

  // Catch unawaited promise rejections (forgot to .catch on a fetch
  // is the canonical case). Sentry has its own handler for these but
  // we add a tag so they show up as a distinct group in the dashboard.
  window.addEventListener('unhandledrejection', (e) => {
    if (!e?.reason) return;
    try {
      const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
      Sentry.captureException(err, { extra: { tag: 'unhandled_rejection' } });
    } catch { /* ignore */ }
  });
}

export function reportError(err, context) {
  if (!DSN) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch { /* never let error reporting itself crash */ }
}

// Sets the anonymous user identifier so errors group by user. Pass the
// RevenueCat appUserId — never an email, name, or any health data. Call
// when premium status is checked / when getAppUserId resolves.
export function identifyUser(appUserId) {
  if (!DSN || !appUserId) return;
  try {
    Sentry.setUser({ id: appUserId });
  } catch { /* ignore */ }
}

// Clears the user identifier. Call from "Reset all data" so a new
// session doesn't leak the old user's id into the next session's events.
export function clearUser() {
  if (!DSN) return;
  try {
    Sentry.setUser(null);
  } catch { /* ignore */ }
}
