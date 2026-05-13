// BEHAVIORAL CONTRACT — App boots without falling into the ErrorBoundary.
//
// The ErrorBoundary renders the text "Something went wrong" when ANY child
// throws during render — including the lazy useState initializers that
// read from localStorage. A future import that breaks at module load time
// would still let the page render, but only show the boundary fallback.
// That's the silent regression we care about: the app "loads" but every
// user lands on a maintenance screen. This test fails loud in that case.

// Stub native-only modules that ship ESM-only entry points. CRA's Jest
// config doesn't transform anything under node_modules by default, so
// these would otherwise crash at parse time. We don't exercise their
// behavior in this smoke test — the goal is purely "App's render tree
// doesn't throw."
jest.mock("@revenuecat/purchases-capacitor", () => ({
  Purchases: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
    getOfferings: jest.fn().mockResolvedValue({ current: null }),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
  LOG_LEVEL: { ERROR: "ERROR", WARN: "WARN", INFO: "INFO", DEBUG: "DEBUG" },
}));

import React from "react";
import { render } from "@testing-library/react";

import App from "../App";
import ErrorBoundary from "../ErrorBoundary";

describe("App boot", () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* jsdom edge */ }
  });

  it("renders the App tree without tripping the ErrorBoundary fallback", () => {
    const { queryByText } = render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );

    // If any of App.jsx's imports or first-render code throws, the
    // boundary catches it and paints "Something went wrong" instead of
    // the app. We want the negative assertion — boundary stayed dormant.
    expect(queryByText(/Something went wrong/i)).not.toBeInTheDocument();
  });
});
