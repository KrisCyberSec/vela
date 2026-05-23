/**
 * Analytics — thin PostHog wrapper. No-ops gracefully without an API key,
 * so local dev and screenshots don't pollute the prod project.
 *
 * Launch events are intentionally sparse and non-sensitive:
 *   - activation / retention: onboarding_completed, log_completed,
 *     day_3_reached, day_7_reached, day_14_reached
 *   - premium funnel: premium_feature_tapped, paywall_shown,
 *     paywall_plan_selected, purchase_started, purchase_cancelled,
 *     purchase_failed, paywall_converted, restore_*
 *   - premium value: ask_vela_started/succeeded/failed,
 *     doctor_report_exported, health_sync_*
 *
 * Event props must remain counts, booleans, trigger names, and status
 * strings. No symptoms, notes, Ask Vela text, AI answers, or sleep values.
 *
 * Opt-out: users can disable product analytics from Settings → Privacy & Data.
 * Toggling on sets `vela_analytics_opt_out=true` in localStorage. We honor
 * it at init (never call posthog.init) AND at every track call (defense in
 * depth — if the user opts out mid-session, the next event is dropped).
 */

import posthog from 'posthog-js';

const KEY = process.env.REACT_APP_POSTHOG_KEY || '';
const HOST = process.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com';
const ENABLE_DEV_ANALYTICS = process.env.REACT_APP_ENABLE_DEV_ANALYTICS === 'true';
const OPT_OUT_KEY = 'vela_analytics_opt_out';

let initialized = false;

function isOptedOut() {
  try { return localStorage.getItem(OPT_OUT_KEY) === 'true'; } catch { return false; }
}

export function isAnalyticsOptedOut() {
  return isOptedOut();
}

export function setAnalyticsOptedOut(optOut) {
  try {
    if (optOut) {
      localStorage.setItem(OPT_OUT_KEY, 'true');
      // Best-effort: stop sending events from the current session too.
      if (initialized) {
        try { posthog.opt_out_capturing(); } catch {}
      }
    } else {
      localStorage.removeItem(OPT_OUT_KEY);
      if (initialized) {
        try { posthog.opt_in_capturing(); } catch {}
      }
    }
  } catch { /* private mode */ }
}

export function initAnalytics() {
  if (initialized || !KEY) return;
  if (process.env.NODE_ENV !== 'production' && !ENABLE_DEV_ANALYTICS) return;
  if (isOptedOut()) return;
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
  if (isOptedOut()) return;
  try {
    posthog.capture(event, props);
  } catch {
    // never let analytics break the app
  }
}

export function identify(distinctId, props) {
  if (!initialized) return;
  if (isOptedOut()) return;
  try {
    posthog.identify(distinctId, props);
  } catch {
    // ignore
  }
}
