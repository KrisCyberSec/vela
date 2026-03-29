/**
 * Subscription module — wraps RevenueCat for in-app purchases.
 *
 * Setup steps:
 * 1. npm install @revenuecat/purchases-capacitor
 * 2. Create a RevenueCat account at https://www.revenuecat.com
 * 3. Add your iOS app in RevenueCat, paste the shared secret from App Store Connect
 * 4. Create an entitlement called "premium"
 * 5. Create an offering called "default" with $5.99/mo and $49.99/yr subscriptions
 * 6. Replace RC_API_KEY below with your RevenueCat Apple API key
 */

// import { Capacitor } from '@capacitor/core';
// import Purchases from '@revenuecat/purchases-capacitor';

const RC_API_KEY = 'appl_YOUR_REVENUECAT_API_KEY'; // Replace with real key

export async function initPurchases() {
  // Uncomment once @revenuecat/purchases-capacitor is installed:
  // if (!Capacitor.isNativePlatform()) return;
  // await Purchases.configure({ apiKey: RC_API_KEY });
  console.log('[Subscription] initPurchases called (stub). API key:', RC_API_KEY.slice(0, 8) + '...');
}

export async function getOfferings() {
  // Uncomment once configured:
  // const { offerings } = await Purchases.getOfferings();
  // return offerings.current;
  return null;
}

export async function purchasePackage(pkg) {
  // Uncomment once configured:
  // const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  // return customerInfo;
  return null;
}

export async function checkSubscription() {
  // Uncomment once configured:
  // if (!Capacitor.isNativePlatform()) return { isPremium: false };
  // const { customerInfo } = await Purchases.getCustomerInfo();
  // const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
  // return { isPremium, customerInfo };
  return { isPremium: false };
}

export async function restorePurchases() {
  // Uncomment once configured:
  // const { customerInfo } = await Purchases.restorePurchases();
  // return customerInfo;
  return null;
}
