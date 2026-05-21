// VelaHealthPlugin — custom Capacitor plugin that wraps Apple HealthKit.
//
// Mirrors the JS surface in src/healthkit.js (registerPlugin('VelaHealth')):
//   - requestAuthorization(read: [String], write: [String])
//   - queryHKitSampleType(sampleName: String, startDate: ISO, endDate: ISO, limit: Int)
//
// We deliberately keep this small: today the JS layer only asks for sleep
// analysis (see src/healthkit.js). HRV / step count / resting heart rate
// branches remain in sampleType(forName:) and canonicalUnit(forName:)
// below as forward-compat hooks — they won't fire unless the JS read
// scope is expanded to include them. Adding more types later is a
// matter of extending the JS read array.
//
// Required project setup (also documented in docs/operations/ios-build.md):
//   - Xcode → Signing & Capabilities → + Capability → HealthKit
//   - Info.plist: NSHealthShareUsageDescription (added)
//   - Info.plist: NSHealthUpdateUsageDescription (added — even though we
//     don't write, iOS requires the string for any HealthKit-using app)

import Foundation
import Capacitor
import HealthKit

@objc(VelaHealthPlugin)
public class VelaHealthPlugin: CAPPlugin {

    private let healthStore = HKHealthStore()
    private let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    /// Maps the JS-side sample names to HealthKit's strongly-typed identifiers.
    /// Returns nil for unsupported types so we surface a clean rejection
    /// rather than crashing on a force-unwrap.
    private func sampleType(forName name: String) -> HKSampleType? {
        switch name {
        case "sleepAnalysis":
            return HKObjectType.categoryType(forIdentifier: .sleepAnalysis)
        case "heartRateVariability":
            return HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)
        case "stepCount":
            return HKObjectType.quantityType(forIdentifier: .stepCount)
        case "restingHeartRate":
            return HKObjectType.quantityType(forIdentifier: .restingHeartRate)
        default:
            return nil
        }
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device.")
            return
        }
        let readNames = call.getArray("read", String.self) ?? []
        let writeNames = call.getArray("write", String.self) ?? []

        let readTypes = Set(readNames.compactMap { sampleType(forName: $0) })
        let writeTypes = Set(writeNames.compactMap { sampleType(forName: $0) as? HKSampleType })

        // We only ever request read; write would need separate cast/handling.
        healthStore.requestAuthorization(toShare: nil, read: readTypes) { success, error in
            if let error = error {
                call.reject("Authorization failed: \(error.localizedDescription)")
                return
            }
            // Apple deliberately doesn't tell you which types the user denied
            // (privacy by design) — `success: true` means the prompt completed,
            // not that all types were granted. The JS layer treats per-query
            // empty results as "user denied or no data," which is correct.
            call.resolve(["granted": success])
            // writeTypes captured to silence unused-var warning; not actually requested.
            _ = writeTypes
        }
    }

    @objc func queryHKitSampleType(_ call: CAPPluginCall) {
        guard let sampleName = call.getString("sampleName") else {
            call.reject("sampleName is required")
            return
        }
        guard let type = sampleType(forName: sampleName) else {
            call.reject("Unsupported sampleName: \(sampleName)")
            return
        }
        guard let startStr = call.getString("startDate"),
              let endStr = call.getString("endDate"),
              let start = parseDate(startStr),
              let end = parseDate(endStr) else {
            call.reject("startDate and endDate are required ISO 8601 strings")
            return
        }
        let limit = call.getInt("limit") ?? HKObjectQueryNoLimit

        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let sortByStart = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)

        let query = HKSampleQuery(
            sampleType: type,
            predicate: predicate,
            limit: limit,
            sortDescriptors: [sortByStart]
        ) { [weak self] _, samples, error in
            guard let self = self else { return }
            if let error = error {
                call.reject("Query failed: \(error.localizedDescription)")
                return
            }
            let resultData: [[String: Any]] = (samples ?? []).map { sample in
                self.serialize(sample: sample, sampleName: sampleName)
            }
            call.resolve(["resultData": resultData])
        }
        healthStore.execute(query)
    }

    private func parseDate(_ s: String) -> Date? {
        if let d = isoFormatter.date(from: s) { return d }
        // Fallback for ISO strings without fractional seconds
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: s)
    }

    /// Shapes each sample into the dict the JS layer expects:
    ///   { startDate: ISO, endDate: ISO, value: Number-or-String }
    /// Sleep samples: value is the human-readable category ("asleepCore", "awake", etc.)
    /// Quantity samples: value is the numeric reading in the canonical unit
    private func serialize(sample: HKSample, sampleName: String) -> [String: Any] {
        var out: [String: Any] = [
            "startDate": isoFormatter.string(from: sample.startDate),
            "endDate": isoFormatter.string(from: sample.endDate),
            "uuid": sample.uuid.uuidString,
        ]

        if let cat = sample as? HKCategorySample {
            out["value"] = sleepValueLabel(rawValue: cat.value)
        } else if let qty = sample as? HKQuantitySample {
            out["value"] = qty.quantity.doubleValue(for: canonicalUnit(forName: sampleName))
        }
        return out
    }

    private func sleepValueLabel(rawValue: Int) -> String {
        // Apple unified sleep categories in iOS 16+. Older awake/asleep
        // samples still flow through, so we surface both shapes.
        switch rawValue {
        case HKCategoryValueSleepAnalysis.inBed.rawValue: return "inBed"
        case HKCategoryValueSleepAnalysis.asleep.rawValue: return "asleep"
        default:
            if #available(iOS 16.0, *) {
                switch rawValue {
                case HKCategoryValueSleepAnalysis.awake.rawValue: return "awake"
                case HKCategoryValueSleepAnalysis.asleepCore.rawValue: return "asleepCore"
                case HKCategoryValueSleepAnalysis.asleepDeep.rawValue: return "asleepDeep"
                case HKCategoryValueSleepAnalysis.asleepREM.rawValue: return "asleepREM"
                default: break
                }
            }
            return "unknown"
        }
    }

    private func canonicalUnit(forName name: String) -> HKUnit {
        switch name {
        case "heartRateVariability":
            return .secondUnit(with: .milli)   // ms (SDNN)
        case "stepCount":
            return .count()
        case "restingHeartRate":
            return HKUnit.count().unitDivided(by: .minute())  // bpm
        default:
            return .count()
        }
    }
}
