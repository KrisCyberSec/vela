/**
 * Error reporting — Sentry. No-ops without a DSN, so local dev stays quiet.
 * Init must run before React mounts; called from src/index.js.
 */

import * as Sentry from '@sentry/react';

const DSN = process.env.REACT_APP_SENTRY_DSN || '';
const ENV = process.env.NODE_ENV || 'development';

export function initErrorReporting() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: ENV,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

export function reportError(err, context) {
  if (!DSN) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
