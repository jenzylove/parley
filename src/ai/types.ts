import type { ProtocolMessage } from "@/core/parley-core";

export type NegotiationExplanation = {
  summary: string;
  rationale: string;
  tradeoffs: string[];
  buyerPerspective: string;
  sellerPerspective: string;
};

export type ExplanationInput = {
  protocolMessage: ProtocolMessage;
  deterministicDecision: string;
  publicContext: {
    currentRound: number;
    maxRounds: number;
    currentState: string;
    service: string;
    buyerTargetPrice: number;
    buyerMaxPrice: number;
    currency: string;
    requestedItems: string[];
    desiredDeliveryDays: number;
    publicSellerTerms: {
      currency: string;
      standardDeliveryDays: number;
      maxRounds: number;
    };
  };
};

export type AIProvider = {
  explainCounterOffer(input: ExplanationInput): Promise<NegotiationExplanation>;
  explainAgreement(input: ExplanationInput): Promise<NegotiationExplanation>;
  summarizeNegotiation(input: ExplanationInput): Promise<NegotiationExplanation>;
};

export type ExplainedProtocolMessage = {
  protocolMessage: ProtocolMessage;
  deterministicDecision: string;
  aiExplanation: NegotiationExplanation;
};
