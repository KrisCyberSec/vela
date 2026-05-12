// HealthKit wrapper — Apple Health integration for Vela Premium.
//
// Reads sleep hours from Apple Health so users don't have to retype
// data their watch already captured.
//
// IMPLEMENTATION STATUS
// ─────────────────────
// Native plugin: ios/App/App/Plugins/VelaHealthPlugin.swift (+ .m bridge).
// Registered as "VelaHealth" via the CAP_PLUGIN macro; Capacitor auto-
// discovers it on app start. Exposes requestAuthorization() and
// queryHKitSampleType() — same shape this module calls.
//
// On native iOS: pluginAvailable() returns true and the rest of the
// module makes real HealthKit reads.
// On web/dev: getHealthKitStatus() returns "no-native" and every
// fetch returns null gracefully — no errors, no vaporware claim.
//
// First-time setup (already in repo, but documented here for future
// dev who needs to recreate the iOS project):
//   - Info.plist: NSHealthShareUsageDescription (required)
//   - Info.plist: NSHealthUpdateUsageDescription (Apple requires the
//     string for any HealthKit-using app, even read-only)
//   - App.entitlements: com.apple.developer.healthkit = true
//   - Xcode → Signing & Capabilities → + Capability → HealthKit (this
//     adds the entitlement to the provisioning profile; entitlements
//     file is already wired in pbxproj)

import { Capacitor, registerPlugin } from "@capacitor/core";

const STORAGE_KEY = "vela_healthkit_enabled";
const PLUGIN_NAME = "VelaHealth";

// registerPlugin returns a proxy that resolves to the native plugin
// when one is registered with this name; otherwise calls reject at
// runtime. We catch those rejections and surface as "no-plugin".
const HealthPlugin = registerPlugin(PLUGIN_NAME);

function pluginAvailable() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return Capacitor.isPluginAvailable && Capacitor.isPluginAvailable(PLUGIN_NAME);
  } catch {
    return false;
  }
}

// Read whether the user has previously granted permission. Never
// auto-prompts — only on explicit Settings toggle.
export function isHealthKitEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

// "available" = ready to call · "no-plugin" = native plugin missing ·
// "no-native" = running on web · "permission-denied" = user said no
export async function getHealthKitStatus() {
  if (!Capacitor.isNativePlatform()) return "no-native";
  if (!pluginAvailable()) return "no-plugin";
  return "available";
}

export async function enableHealthKit() {
  if (!pluginAvailable()) {
    return { ok: false, reason: "Apple Health isn't available in this build." };
  }
  try {
    // Sleep is the only HealthKit type Vela actually reads today. Keep the
    // scope minimal — Apple review flags over-broad HealthKit requests.
    await HealthPlugin.requestAuthorization({
      read: ["sleepAnalysis"],
      write: [],
    });
    localStorage.setItem(STORAGE_KEY, "true");
    return { ok: true };
  } catch (err) {
    console.error("HealthKit auth failed:", err);
    return { ok: false, reason: "Couldn't get Apple Health permission." };
  }
}

export async function disableHealthKit() {
  // Apple doesn't expose programmatic revoke — user must do it via
  // iOS Settings → Privacy → Health → Vela. We just stop reading.
  try { localStorage.setItem(STORAGE_KEY, "false"); } catch {}
  return { ok: true };
}

// Yesterday's sleep total in hours (sums all non-awake sleep samples
// from 6pm yesterday to 11am today). Returns null on any failure.
export async function fetchYesterdaySleep() {
  if (!isHealthKitEnabled() || !pluginAvailable()) return null;
  try {
    const now = new Date();
    const yEnd = new Date(now); yEnd.setHours(11, 0, 0, 0);
    const yStart = new Date(now); yStart.setDate(yStart.getDate() - 1); yStart.setHours(18, 0, 0, 0);
    const result = await HealthPlugin.queryHKitSampleType({
      sampleName: "sleepAnalysis",
      startDate: yStart.toISOString(),
      endDate: yEnd.toISOString(),
      limit: 100,
    });
    const samples = result?.resultData || result?.data || [];
    if (!Array.isArray(samples) || samples.length === 0) return null;
    let totalMs = 0;
    samples.forEach((s) => {
      const value = (s.value || s.sleepValue || "").toString().toLowerCase();
      if (value === "awake" || value === "inbed") return;
      const start = new Date(s.startDate || s.start);
      const end = new Date(s.endDate || s.end);
      if (!isNaN(start) && !isNaN(end)) totalMs += Math.max(0, end - start);
    });
    if (totalMs === 0) return null;
    return Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
  } catch (err) {
    console.warn("HealthKit sleep fetch failed:", err);
    return null;
  }
}

