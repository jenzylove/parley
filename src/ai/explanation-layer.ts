import type { AgreementPayload, NegotiationResult, ProtocolMessage, SellerPolicy, ServiceRequest } from "@/core/parley-core";
import type { AIProvider, ExplainedProtocolMessage, ExplanationInput } from "./types";
import { validateNegotiationExplanation } from "./validation";

export function createPublicNegotiationContext(
  result: NegotiationResult,
  request: ServiceRequest,
  policy: SellerPolicy,
) {
  return {
    currentRound: result.session.currentRound,
    maxRounds: result.session.maxRounds,
    currentState: result.session.currentState,
    service: request.service,
    buyerTargetPrice: request.targetPrice,
    buyerMaxPrice: request.maxPrice,
    currency: request.currency,
    requestedItems: request.requestedItems,
    desiredDeliveryDays: request.desiredDeliveryDays,
    publicSellerTerms: {
      currency: policy.currency,
      standardDeliveryDays: policy.standardDeliveryDays,
      maxRounds: policy.maxRounds,
    },
  };
}

function safeProtocolMessageForAI(message: ProtocolMessage): ProtocolMessage {
  if (message.messageType !== "Agreement") {
    return message;
  }

  const payload = message.payload as AgreementPayload;

  return {
    ...message,
    payload: {
      ...payload,
      savings: 0,
      reason: "Agreement was finalized by deterministic validation. Private seller policy values are not exposed to AI.",
      policyExplanation: {
        acceptedBecause: "Agreement was finalized by deterministic validation.",
        constraintsApplied: ["Private policy details are not exposed to AI."],
        finalPolicyFloor: 0,
        buyerSavingsVsSellerPreferred: 0,
      },
    },
  };
}

export function describeDeterministicDecision(message: ProtocolMessage): string {
  switch (message.messageType) {
    case "Offer":
      return "State machine accepted the buyer opening offer and moved the session to seller response.";
    case "CounterOffer":
      return "Constraint solver determined the previous offer was not mutually acceptable and emitted a bounded counteroffer.";
    case "Accept":
      return "Constraint solver determined the referenced offer satisfies the receiving agent's constraints.";
    case "Agreement":
      return "State machine finalized a validated agreement from the accepted offer.";
    case "Reject":
      return "State machine recorded a rejection and terminated the negotiation.";
    case "NoDeal":
      return "State machine terminated because constraints or max rounds prevented agreement.";
  }
}

function methodForMessage(message: ProtocolMessage): keyof AIProvider {
  if (message.messageType === "Agreement") return "explainAgreement";
  if (message.messageType === "CounterOffer") return "explainCounterOffer";

  return "summarizeNegotiation";
}

export async function explainNegotiation(
  result: NegotiationResult,
  request: ServiceRequest,
  policy: SellerPolicy,
  provider: AIProvider,
): Promise<ExplainedProtocolMessage[]> {
  const publicContext = createPublicNegotiationContext(result, request, policy);

  return Promise.all(
    result.session.messageHistory.map(async (protocolMessage) => {
      const input: ExplanationInput = {
        protocolMessage: safeProtocolMessageForAI(protocolMessage),
        deterministicDecision: describeDeterministicDecision(protocolMessage),
        publicContext,
      };
      const method = methodForMessage(protocolMessage);
      const aiExplanation = validateNegotiationExplanation(await provider[method](input));

      return {
        protocolMessage,
        deterministicDecision: input.deterministicDecision,
        aiExplanation,
      };
    }),
  );
}
