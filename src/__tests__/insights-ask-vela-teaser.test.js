import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import InsightsScreen from "../screens/Insights";

jest.mock("../analytics", () => ({ track: jest.fn() }));
jest.mock("../api", () => ({
  apiHeaders: jest.fn((headers) => headers),
  apiUrl: jest.fn((path) => path),
}));
jest.mock("../errorReporting", () => ({ reportError: jest.fn() }));
jest.mock("../subscription", () => ({ getAppUserId: jest.fn() }));
jest.mock("../lib/haptic", () => ({ haptic: jest.fn() }));

describe("Insights Ask Vela teaser", () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* jsdom edge */ }
  });

  it("shows a locked Ask Vela preview before seven logged days", () => {
    const onNavigate = jest.fn();

    render(
      <InsightsScreen
        logs={[]}
        profile={{}}
        isPremium={false}
        onShowPaywall={jest.fn()}
        onNavigate={onNavigate}
      />
    );

    expect(screen.getByLabelText("Ask Vela preview")).toBeInTheDocument();
    expect(screen.getByText(/Ask Vela is learning your/i)).toBeInTheDocument();
    expect(screen.getAllByText("0 of 7 days logged").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Log today" }));

    expect(onNavigate).toHaveBeenCalledWith("tracker");
  });
});
