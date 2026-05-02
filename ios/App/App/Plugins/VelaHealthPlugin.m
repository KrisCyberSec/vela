// Capacitor's Obj-C bridge — required even for Swift-only plugins so
// the Capacitor runtime can find the methods at @objc dispatch time.
//
// Plugin name MUST match the registerPlugin('VelaHealth') call in
// src/healthkit.js. JS_METHOD names map to the @objc func names in
// VelaHealthPlugin.swift.

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(VelaHealthPlugin, "VelaHealth",
    CAP_PLUGIN_METHOD(requestAuthorization, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(queryHKitSampleType, CAPPluginReturnPromise);
)
