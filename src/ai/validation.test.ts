import { describe, expect, it } from "vitest";
import { validateNegotiationExplanation } from "./validation";

describe("AI explanation validation", () => {
  it("accepts complete structured explanation output", () => {
    const explanation = validateNegotiationExplanation({
      summary: "A counteroffer was created.",
      rationale: "The deterministic engine required another round.",
      tradeoffs: ["Price moved upward.", "Delivery stayed stable."],
      buyerPerspective: "The buyer gets a valid next offer.",
      sellerPerspective: "The seller remains inside policy constraints.",
    });

    expect(explanation.tradeoffs).toHaveLength(2);
  });

  it("rejects incomplete explanation output", () => {
    expect(() =>
      validateNegotiationExplanation({
        summary: "Missing fields",
        rationale: "",
        tradeoffs: [],
      }),
    ).toThrow();
  });
});
