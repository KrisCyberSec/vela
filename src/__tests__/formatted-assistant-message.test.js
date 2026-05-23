import { render, screen } from "@testing-library/react";

import { FormattedAssistantMessage } from "../components/FormattedAssistantMessage";

describe("FormattedAssistantMessage", () => {
  it("preserves paragraph breaks instead of collapsing an answer into one block", () => {
    const answer = "First paragraph with *emphasis*.\n\nSecond paragraph with the next step.";

    const { container } = render(<FormattedAssistantMessage text={answer} />);

    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(screen.getByText("emphasis").tagName).toBe("EM");
    expect(screen.getByText(/Second paragraph/)).toBeInTheDocument();
  });

  it("renders simple bullet lists when the model returns one", () => {
    const answer = "- Bring the 16/16 caffeine pattern\n- Ask about sleep disruption";

    const { container } = render(<FormattedAssistantMessage text={answer} />);

    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("Bring the 16/16 caffeine pattern")).toBeInTheDocument();
  });
});
