/**
 * Subscription module — wraps RevenueCat for in-app purchases.
 *
 * Setup is documented in docs/operations/analytics-and-billing.md.
 * The short version:
 *   1. Create a RevenueCat account, add the iOS app, create a "premium" entitlement
 *      and a "default" offering with the $5.99/mo and $49.99/yr packages.
 *   2. Set REACT_APP_REVENUECAT_IOS_API_KEY in .env (App-specific Apple API key).
 *   3. Configure the matching in-app-purchase products in App Store Connect.
 *
 * Three runtime modes (returned as the `mode` field on every error):
 *   - 'native'        — iOS + valid API key. Real RevenueCat path.
 *   - 'web'           — non-native (browser dev preview). The caller's web fallback may
 *                       safely unlock premium locally for testing — there's no real Apple
 *                       receipt to validate against, and never any money at risk.
 *   - 'misconfigured' — native iOS but the API key is missing. THIS IS A CONFIG BUG;
 *                       the caller MUST NOT grant premium in this case (an empty key in
 *                       a production build is a deployment error, not a dev fallback).
 *
 * Distinguishing 'web' from 'misconfigured' is the difference between "free premium for
 * everyone in the App Store" and "free premium when you `npm start` locally".
 */

import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { reportError } from './errorReporting';

const RC_API_KEY = process.env.REACT_APP_REVENUECAT_IOS_API_KEY || '';
const ENTITLEMENT_ID = 'premium';

let configured = false;
let misconfigReported = false;

function getMode() {
  if (!Capacitor.isNativePlatform()) return 'web';
  if (!RC_API_KEY) return 'misconfigured';
  return 'native';
}

function reportMisconfigOnce() {
  if (misconfigReported) return;
  misconfigReported = true;
  const err = new Error('RevenueCat API key missing on native iOS build');
  console.error('[Subscription] CRITICAL: native iOS build is missing REACT_APP_REVENUECAT_IOS_API_KEY. Subscriptions disabled.');
  reportError(err, { tag: 'subscription_misconfig' });
}

export async function initPurchases() {
  const mode = getMode();
  if (mode === 'misconfigured') reportMisconfigOnce();
  if (mode !== 'native' || configured) return;
  try {
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    await Purchases.configure({ apiKey: RC_API_KEY });
    configured = true;
  } catch (err) {
    console.warn('[Subscription] configure failed:', err);
    reportError(err, { tag: 'subscription_configure_failed' });
  }
}

export async function getOfferings() {
  if (getMode() !== 'native') return null;
  try {
    const { current } = await Purchases.getOfferings();
    return current || null;
  } catch (err) {
    console.warn('[Subscription] getOfferings failed:', err);
    reportError(err, { tag: 'subscription_offerings_failed' });
    return null;
  }
}

// plan: 'annual' | 'monthly' — maps to RevenueCat package identifiers $rc_annual / $rc_monthly
export async function purchasePlan(plan) {
  const mode = getMode();
  if (mode === 'misconfigured') {
    reportMisconfigOnce();
    return { isPremium: false, cancelled: false, error: 'misconfigured', mode };
  }
  if (mode === 'web') {
    return { isPremium: false, cancelled: false, error: 'web_fallback', mode };
  }
  try {
    const offering = await getOfferings();
    if (!offering) return { isPremium: false, cancelled: false, error: 'no_offering', mode };
    const pkg = plan === 'monthly' ? offering.monthly : offering.annual;
    if (!pkg) return { isPremium: false, cancelled: false, error: 'no_package', mode };
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return {
      isPremium: !!customerInfo.entitlements.active[ENTITLEMENT_ID],
      cancelled: false,
      customerInfo,
      mode,
    };
  } catch (err) {
    const cancelled = err && (err.code === '1' || err.userCancelled === true);
    if (!cancelled) {
      reportError(err, { tag: 'subscription_purchase_failed', plan });
    }
    return { isPremium: false, cancelled, error: cancelled ? 'cancelled' : (err?.message || 'unknown'), mode };
  }
}

export async function checkSubscription() {
  const mode = getMode();
  if (mode === 'misconfigured') {
    reportMisconfigOnce();
    return { isPremium: false, mode };
  }
  if (mode !== 'native') return { isPremium: false, mode };
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return {
      isPremium: !!customerInfo.entitlements.active[ENTITLEMENT_ID],
      customerInfo,
      mode,
    };
  } catch (err) {
    console.warn('[Subscription] checkSubscription failed:', err);
    reportError(err, { tag: 'subscription_check_failed' });
    return { isPremium: false, mode };
  }
}

export async function restorePurchases() {
  const mode = getMode();
  if (mode === 'misconfigured') {
    reportMisconfigOnce();
    return { isPremium: false, mode, error: 'misconfigured' };
  }
  if (mode !== 'native') return { isPremium: false, mode, error: 'web_fallback' };
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return {
      isPremium: !!customerInfo.entitlements.active[ENTITLEMENT_ID],
      customerInfo,
      mode,
    };
  } catch (err) {
    console.warn('[Subscription] restorePurchases failed:', err);
    reportError(err, { tag: 'subscription_restore_failed' });
    return { isPremium: false, mode, error: err?.message || 'unknown' };
  }
}
