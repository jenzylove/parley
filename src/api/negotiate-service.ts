import { createAIProvider } from "@/ai/provider-factory";
import { explainNegotiation } from "@/ai/explanation-layer";
import { applyProtocolMessage, createMarketIntelligence, runNegotiation } from "@/core/parley-core";
import { buildCommerceOrder } from "@/cap/lifecycle";
import { createSettlementAdapter } from "@/cap/settlement-adapter-factory";
import { PROTOCOL_VERSION } from "./protocol-version";
import { getNegotiation, saveNegotiation, updateNegotiationSession } from "./store";
import type {
  ErrorResponse,
  HistoryResponse,
  MessageNegotiationRequest,
  MessageNegotiationResponse,
  NegotiationResponse,
  SessionResponse,
  StartNegotiationRequest,
} from "./types";

export function versionedError(error: string): ErrorResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    error,
  };
}

export async function startNegotiation(payload: StartNegotiationRequest): Promise<NegotiationResponse> {
  const result = runNegotiation(payload.request, payload.policy);
  const commerce = {
    order: await buildCommerceOrder(
      { negotiationResult: result },
      createSettlementAdapter(),
    ),
  };
  const market = createMarketIntelligence(payload.request, payload.policy, result.agreement);
  saveNegotiation(result, commerce, market);

  return {
    protocolVersion: PROTOCOL_VERSION,
    result,
    commerce: {
      order: commerce.order,
      lockedTerms: commerce.order.lockedTerms,
    },
    market,
    explanations: await explainNegotiation(result, payload.request, payload.policy, createAIProvider()),
  };
}

export function applyNegotiationMessage(payload: MessageNegotiationRequest): MessageNegotiationResponse | ErrorResponse {
  const stored = getNegotiation(payload.negotiationId);

  if (!stored) {
    return versionedError("Negotiation not found");
  }

  const transition = applyProtocolMessage(stored.session, payload.message);

  if (!transition.ok) {
    return versionedError(transition.error);
  }

  return {
    protocolVersion: PROTOCOL_VERSION,
    session: updateNegotiationSession(payload.negotiationId, transition.session),
    commerce: stored.commerce,
    market: stored.market,
  };
}

export function getNegotiationSession(negotiationId: string): SessionResponse | ErrorResponse {
  const stored = getNegotiation(negotiationId);

  if (!stored) {
    return versionedError("Negotiation not found");
  }

  return {
    protocolVersion: PROTOCOL_VERSION,
    session: stored.session,
    commerce: stored.commerce,
    market: stored.market,
  };
}

export function getNegotiationHistory(negotiationId: string): HistoryResponse | ErrorResponse {
  const stored = getNegotiation(negotiationId);

  if (!stored) {
    return versionedError("Negotiation not found");
  }

  return {
    protocolVersion: PROTOCOL_VERSION,
    negotiationId,
    messageHistory: stored.session.messageHistory,
  };
}
