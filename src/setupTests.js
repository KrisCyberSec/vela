// Test setup — runs once per test file before the suite.
//
// Pulls in jest-dom's custom matchers (toBeInTheDocument, etc.) so the
// smoke tests under src/__tests__/ and src/lib/__tests__/ read naturally.
// CRA auto-loads this file via react-scripts; no jest config needed.

import "@testing-library/jest-dom";

// jsdom (used by react-scripts) doesn't expose TextEncoder/TextDecoder.
// jspdf's transitive deps (fast-png → iobuffer) reach for them at import
// time. Polyfill from Node's util so importing App in the boot smoke
// test doesn't explode before our assertions run.
import { TextEncoder, TextDecoder } from "util";
if (typeof global.TextEncoder === "undefined") global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === "undefined") global.TextDecoder = TextDecoder;
