import { createAIProvider } from "@/ai/provider-factory";
import { explainNegotiation } from "@/ai/explanation-layer";
import {
  applyProtocolMessage,
  createAgreement,
  createMarketIntelligence,
  createNegotiationSession,
  findOfferById,
  runNegotiation,
  validateServiceRequest,
  verifyMessageSignature,
} from "@/core/parley-core";
import type { AcceptPayload, NegotiationResult, ProtocolMessage, ServiceRequest } from "@/core/parley-core";
import { buildCommerceOrder } from "@/cap/lifecycle";
import { createSettlementAdapter } from "@/cap/settlement-adapter-factory";
import type { SettlementAdapter } from "@/cap/types";
import { getPlatformKeyPair } from "./platform-identity";
import { getSellerPolicy } from "./seller-registry";
import { PROTOCOL_VERSION } from "./protocol-version";
import { getNegotiation, listPendingForSeller, saveNegotiation, updateNegotiationSession } from "./store";
import type {
  ErrorResponse,
  HistoryResponse,
  MessageNegotiationRequest,
  MessageNegotiationResponse,
  NegotiationResponse,
  OpenNegotiationRequest,
  OpenNegotiationResponse,
  PendingForSellerResponse,
  SessionResponse,
  StartNegotiationRequest,
} from "./types";

export function versionedError(error: string): ErrorResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    error,
  };
}

function sellerNotFoundError(sellerAgentId: string): ErrorResponse {
  return versionedError(
    `Seller "${sellerAgentId}" is not registered. Call POST /api/sellers/register with a SellerPolicy first.`,
  );
}

/**
 * Resolves which public key a message's claimed sender should verify
 * against — the buyer's own declared key (recorded at negotiation open) or
 * the seller's registered key. Unknown senders can't be verified at all.
 */
function resolveSenderPublicKey(
  request: ServiceRequest,
  sellerAgentId: string,
  message: ProtocolMessage,
): string | undefined {
  if (message.sender === request.buyerAgentId) return request.buyerPublicKey;
  if (message.sender === sellerAgentId) return getSellerPolicy(sellerAgentId)?.publicKey;

  return undefined;
}

function verifySenderOrError(request: ServiceRequest, sellerAgentId: string, message: ProtocolMessage): ErrorResponse | undefined {
  const publicKey = resolveSenderPublicKey(request, sellerAgentId, message);

  if (!publicKey) {
    return versionedError(`Cannot verify message: sender "${message.sender}" is not a known party to this negotiation.`);
  }

  if (!verifyMessageSignature(message, publicKey)) {
    return versionedError(`Message signature is missing or invalid for sender "${message.sender}".`);
  }

  return undefined;
}

export async function startNegotiation(
  payload: StartNegotiationRequest,
  adapter: SettlementAdapter = createSettlementAdapter(),
): Promise<NegotiationResponse | ErrorResponse> {
  const policy = getSellerPolicy(payload.sellerAgentId);

  if (!policy) {
    return sellerNotFoundError(payload.sellerAgentId);
  }

  const result = runNegotiation(payload.request, policy, getPlatformKeyPair());
  const commerce = {
    order: await buildCommerceOrder({ negotiationResult: result }, adapter),
  };
  const market = createMarketIntelligence(payload.request, policy, result.agreement);
  saveNegotiation(result, payload.request, commerce, market);

  return {
    protocolVersion: PROTOCOL_VERSION,
    result,
    commerce: {
      order: commerce.order,
      lockedTerms: commerce.order.lockedTerms,
    },
    market,
    explanations: await explainNegotiation(result, payload.request, policy, createAIProvider()),
  };
}

/**
 * Opens a negotiation from the buyer's own already-signed opening Offer —
 * Parley never constructs the buyer's first move on its behalf, since a
 * message Parley authored wouldn't actually be signable by the buyer. Does
 * not auto-resolve; a real counterparty (a standalone seller process, or
 * another team's agent) drives the rest turn-by-turn through
 * /api/negotiate/message.
 */
export function openNegotiation(payload: OpenNegotiationRequest): OpenNegotiationResponse | ErrorResponse {
  const policy = getSellerPolicy(payload.sellerAgentId);

  if (!policy) {
    return sellerNotFoundError(payload.sellerAgentId);
  }

  const requestValidation = validateServiceRequest(payload.request);
  if (!requestValidation.ok) {
    return versionedError(requestValidation.errors.join("; "));
  }

  const verifyError = verifySenderOrError(payload.request, payload.sellerAgentId, payload.openingOffer);
  if (verifyError) {
    return verifyError;
  }

  let session = createNegotiationSession(payload.request, policy, payload.openingOffer.payload.negotiationId);

  if (getNegotiation(session.negotiationId)) {
    return versionedError(`negotiationId "${session.negotiationId}" is already in use.`);
  }

  const transition = applyProtocolMessage(session, payload.openingOffer);

  if (!transition.ok) {
    return versionedError(transition.error);
  }

  session = transition.session;
  const result: NegotiationResult = { session };
  saveNegotiation(result, payload.request);

  return { protocolVersion: PROTOCOL_VERSION, session };
}

export async function applyNegotiationMessage(
  payload: MessageNegotiationRequest,
): Promise<MessageNegotiationResponse | ErrorResponse> {
  const stored = getNegotiation(payload.negotiationId);

  if (!stored) {
    return versionedError("Negotiation not found");
  }

  // State-machine validity first (e.g. "terminal sessions cannot receive more
  // messages") — that's a fact about the negotiation regardless of who's
  // asking. Only once a message would otherwise be accepted do we spend the
  // extra step confirming it actually came from who it claims.
  const transition = applyProtocolMessage(stored.session, payload.message);

  if (!transition.ok) {
    return versionedError(transition.error);
  }

  const verifyError = verifySenderOrError(stored.request, stored.session.sellerAgentId, payload.message);
  if (verifyError) {
    return verifyError;
  }

  if (payload.message.messageType !== "Accept") {
    const session = updateNegotiationSession(payload.negotiationId, transition.session);

    return {
      protocolVersion: PROTOCOL_VERSION,
      session,
      commerce: stored.commerce,
      market: stored.market,
    };
  }

  // An Accept was just recorded — finalize with a server-synthesized,
  // platform-attested Agreement. Only the party holding the seller's
  // registered policy can honestly compute policyExplanation, so Parley's
  // registry (not either counterparty) authors and attests it.
  const policy = getSellerPolicy(transition.session.sellerAgentId);
  if (!policy) {
    return sellerNotFoundError(transition.session.sellerAgentId);
  }

  const acceptPayload = payload.message.payload as AcceptPayload;
  const acceptedOffer = findOfferById(transition.session, acceptPayload.acceptedMessageId);
  const agreementMessage = createAgreement(
    stored.request,
    policy,
    transition.session,
    acceptedOffer,
    acceptPayload.reason,
    getPlatformKeyPair(),
  );
  const agreementTransition = applyProtocolMessage(transition.session, agreementMessage);

  if (!agreementTransition.ok) {
    return versionedError(agreementTransition.error);
  }

  const result: NegotiationResult = { session: agreementTransition.session, agreement: agreementMessage };
  const commerce = {
    order: await buildCommerceOrder({ negotiationResult: result }, createSettlementAdapter()),
  };
  const market = createMarketIntelligence(stored.request, policy, agreementMessage);
  const session = updateNegotiationSession(payload.negotiationId, agreementTransition.session, commerce, market);

  return {
    protocolVersion: PROTOCOL_VERSION,
    session,
    commerce: {
      order: commerce.order,
      lockedTerms: commerce.order.lockedTerms,
    },
    market,
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

export function getPendingForSeller(sellerAgentId: string): PendingForSellerResponse {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sellerAgentId,
    negotiationIds: listPendingForSeller(sellerAgentId),
  };
}
