// BEHAVIORAL CONTRACT — Paywall trial copy is offer-aware.
//
// Vela may offer a 14-day introductory trial from App Store Connect, but
// the app should only promise that trial when RevenueCat reports the
// selected package has an eligible free intro offer. Otherwise, use
// plain subscription copy and let Apple's purchase sheet be the source
// of truth.

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import PaywallScreen from "../screens/Paywall";
import { getPaywallPlans } from "../subscription";

jest.mock("../subscription", () => ({
  getPaywallPlans: jest.fn(),
}));

const eligiblePlans = {
  annual: {
    title: "Annual",
    priceString: "$69.99",
    priceLine: "$69.99/yr",
    note: "$5.83/mo · billed yearly",
    trial: { label: "14 days", priceLine: "$69.99/yr" },
  },
  monthly: {
    title: "Monthly",
    priceString: "$8.99",
    priceLine: "$8.99/mo",
    note: "Cancel anytime",
    trial: { label: "14 days", priceLine: "$8.99/mo" },
  },
};

describe("Paywall trial copy", () => {
  it("shows eligible free-trial terms for annual and monthly plans", async () => {
    getPaywallPlans.mockResolvedValue(eligiblePlans);

    render(<PaywallScreen onClose={jest.fn()} onSubscribe={jest.fn()} onRestore={jest.fn()} />);

    expect(await screen.findByText("Start 14 days free · then $69.99/yr")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Monthly/i }));

    expect(screen.getByText("Start 14 days free · then $8.99/mo")).toBeInTheDocument();
    expect(screen.queryByText(/Try free for 14 days/i)).not.toBeInTheDocument();
  });

  it("does not promise a trial when no eligible intro offer is returned", async () => {
    getPaywallPlans.mockResolvedValue({
      annual: { ...eligiblePlans.annual, trial: null },
      monthly: { ...eligiblePlans.monthly, trial: null },
    });

    render(<PaywallScreen onClose={jest.fn()} onSubscribe={jest.fn()} onRestore={jest.fn()} />);

    expect(await screen.findByText("Continue with Annual · $69.99/yr")).toBeInTheDocument();
    expect(screen.queryByText(/14 days free/i)).not.toBeInTheDocument();
  });
});
