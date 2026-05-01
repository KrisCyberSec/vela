// HealthKit wrapper — Apple Health integration for Vela Premium.
//
// Reads sleep hours and HRV (heart-rate variability) from Apple Health
// so users don't have to retype data their watch already captured.
//
// IMPLEMENTATION STATUS
// ─────────────────────
// The web/Capacitor code below is wired and ready. The actual native
// HealthKit reads require a Capacitor plugin registered as "VelaHealth"
// (or any plugin name that exposes the methods used here).
//
// Two paths to enable on iOS:
//
//   A) Bring up a community plugin
//      A community Capacitor 8-compatible HealthKit plugin (e.g. the
//      next major of @perfood/capacitor-healthkit, or a fork) registers
//      itself. Wire `PLUGIN_NAME` below to match its registered name and
//      the methods to its API surface.
//
//   B) Write a thin custom plugin
//      ios/App/App/Plugins/VelaHealth.swift implementing
//      requestAuthorization / queryHKitSampleType. Auto-discovered by
//      Capacitor at runtime via registerPlugin().
//      Required Info.plist: NSHealthShareUsageDescription
//      Required entitlement: HealthKit (Signing & Capabilities → +)
//
// Until either path lands, getHealthKitStatus() returns "no-plugin" and
// the Settings row shows "HealthKit not installed in this build" — no
// silent failures, no vaporware claim.

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
    await HealthPlugin.requestAuthorization({
      read: ["sleepAnalysis", "heartRateVariability", "stepCount"],
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

// Yesterday's average HRV (ms). Returns null on any failure.
export async function fetchYesterdayHRV() {
  if (!isHealthKitEnabled() || !pluginAvailable()) return null;
  try {
    const now = new Date();
    const yEnd = new Date(now); yEnd.setHours(0, 0, 0, 0);
    const yStart = new Date(yEnd); yStart.setDate(yStart.getDate() - 1);
    const result = await HealthPlugin.queryHKitSampleType({
      sampleName: "heartRateVariability",
      startDate: yStart.toISOString(),
      endDate: yEnd.toISOString(),
      limit: 200,
    });
    const samples = result?.resultData || result?.data || [];
    if (!Array.isArray(samples) || samples.length === 0) return null;
    const values = samples.map((s) => Number(s.value)).filter((v) => !isNaN(v) && v > 0);
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  } catch (err) {
    console.warn("HealthKit HRV fetch failed:", err);
    return null;
  }
}
