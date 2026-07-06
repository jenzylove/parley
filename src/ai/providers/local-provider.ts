import type { AIProvider, ExplanationInput, NegotiationExplanation } from "../types";

function explanation(input: ExplanationInput, mode: "counter" | "agreement" | "summary"): NegotiationExplanation {
  const message = input.protocolMessage;
  const prefix =
    mode === "agreement"
      ? "The deterministic engine finalized the agreement."
      : mode === "counter"
        ? "The deterministic engine generated or evaluated a counteroffer."
        : "The deterministic engine summarized the negotiation outcome.";

  return {
    summary: `${prefix} Message ${message.id} is a ${message.messageType} in round ${input.publicContext.currentRound}.`,
    rationale: input.deterministicDecision,
    tradeoffs: [
      "Buyer price limits are balanced against delivery timing.",
      "Seller private constraints are enforced by the engine, not exposed to the explanation layer.",
      "The protocol state machine controls whether the message can advance the session.",
    ],
    buyerPerspective: "The buyer sees whether the current protocol message moves price, timing, or finality closer to their constraints.",
    sellerPerspective: "The seller can rely on deterministic policy validation while sharing only safe public context.",
  };
}

export class LocalExplanationProvider implements AIProvider {
  async explainCounterOffer(input: ExplanationInput) {
    return explanation(input, "counter");
  }

  async explainAgreement(input: ExplanationInput) {
    return explanation(input, "agreement");
  }

  async summarizeNegotiation(input: ExplanationInput) {
    return explanation(input, "summary");
  }
}
