/**
 * Analytics — thin PostHog wrapper. No-ops gracefully without an API key,
 * so local dev and screenshots don't pollute the prod project.
 *
 * Five events instrumented in v1 (don't add more without a reason):
 *   - log_started        user opened the daily-log entry screen
 *   - log_completed      user saved a log; props: { uniqueDays, symptomCount }
 *   - ask_vela_used      user submitted a question to Ask Vela
 *   - paywall_shown      paywall appeared; props: { trigger }
 *   - paywall_converted  user completed a purchase; props: { plan }
 *
 * Add new events sparingly — every event is a thing to maintain.
 */

import posthog from 'posthog-js';

const KEY = process.env.REACT_APP_POSTHOG_KEY || '';
const HOST = process.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

export function initAnalytics() {
  if (initialized || !KEY) return;
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    disable_session_recording: true,
  });
  initialized = true;
}

export function track(event, props) {
  if (!initialized) return;
  try {
    posthog.capture(event, props);
  } catch {
    // never let analytics break the app
  }
}

export function identify(distinctId, props) {
  if (!initialized) return;
  try {
    posthog.identify(distinctId, props);
  } catch {
    // ignore
  }
}
