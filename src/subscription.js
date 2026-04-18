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
 * If the API key is missing, this module no-ops and isPremium stays false. Useful
 * for local web dev — the paywall UI still renders, the buttons are inert.
 */

import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';

const RC_API_KEY = process.env.REACT_APP_REVENUECAT_IOS_API_KEY || '';
const ENTITLEMENT_ID = 'premium';

let configured = false;

function isAvailable() {
  return Capacitor.isNativePlatform() && !!RC_API_KEY;
}

export async function initPurchases() {
  if (!isAvailable() || configured) return;
  try {
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    await Purchases.configure({ apiKey: RC_API_KEY });
    configured = true;
  } catch (err) {
    console.warn('[Subscription] configure failed:', err);
  }
}

export async function getOfferings() {
  if (!isAvailable()) return null;
  try {
    const { current } = await Purchases.getOfferings();
    return current || null;
  } catch (err) {
    console.warn('[Subscription] getOfferings failed:', err);
    return null;
  }
}

// plan: 'annual' | 'monthly' — maps to RevenueCat package identifiers $rc_annual / $rc_monthly
export async function purchasePlan(plan) {
  if (!isAvailable()) return { isPremium: false, cancelled: false, error: 'not_available' };
  try {
    const offering = await getOfferings();
    if (!offering) return { isPremium: false, cancelled: false, error: 'no_offering' };
    const pkg = plan === 'monthly' ? offering.monthly : offering.annual;
    if (!pkg) return { isPremium: false, cancelled: false, error: 'no_package' };
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return {
      isPremium: !!customerInfo.entitlements.active[ENTITLEMENT_ID],
      cancelled: false,
      customerInfo,
    };
  } catch (err) {
    const cancelled = err && (err.code === '1' || err.userCancelled === true);
    return { isPremium: false, cancelled, error: cancelled ? 'cancelled' : (err?.message || 'unknown') };
  }
}

export async function checkSubscription() {
  if (!isAvailable()) return { isPremium: false };
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return {
      isPremium: !!customerInfo.entitlements.active[ENTITLEMENT_ID],
      customerInfo,
    };
  } catch (err) {
    console.warn('[Subscription] checkSubscription failed:', err);
    return { isPremium: false };
  }
}

export async function restorePurchases() {
  if (!isAvailable()) return { isPremium: false };
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return {
      isPremium: !!customerInfo.entitlements.active[ENTITLEMENT_ID],
      customerInfo,
    };
  } catch (err) {
    console.warn('[Subscription] restorePurchases failed:', err);
    return { isPremium: false };
  }
}
