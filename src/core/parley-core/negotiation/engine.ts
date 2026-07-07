import type { KeyObject } from "node:crypto";
import type {
  AgreementMessage,
  AgreementPayload,
  NegotiationResult,
  NegotiationSession,
  OfferMessage,
  OfferPayload,
  PolicyExplanation,
  ProtocolMessage,
  SellerPolicy,
  ServiceRequest,
  TransitionResult,
} from "./types";
import {
  sellerMinimumAcceptablePrice,
  validateOfferPayload,
  validateSellerPolicy,
  validateServiceRequest,
} from "./validation";
import { buildAcceptMessage, buildNoDealMessage, createOpeningOffer, decideBuyerMove, decideSellerMove } from "./strategy";
import { signPayload } from "./signing";

const nowIso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

/** negotiationId defaults to a server-generated id, but a buyer opening its own signed offer must supply the id it already signed against. */
export function createNegotiationSession(request: ServiceRequest, policy: SellerPolicy, negotiationId?: string): NegotiationSession {
  return {
    negotiationId: negotiationId ?? id("negotiation"),
    buyerAgentId: request.buyerAgentId,
    sellerAgentId: policy.sellerAgentId,
    currentRound: 0,
    maxRounds: policy.maxRounds,
    currentState: "awaiting_buyer_offer",
    messageHistory: [],
    createdAt: nowIso(),
  };
}

function nextStateForMessage(session: NegotiationSession, message: ProtocolMessage): TransitionResult {
  const expectedReceiver =
    message.sender === session.buyerAgentId ? session.sellerAgentId : session.buyerAgentId;

  if (message.receiver !== expectedReceiver) {
    return { ok: false, error: "message receiver does not match the counterparty", session };
  }

  if (session.currentState === "agreement" || session.currentState === "no_deal") {
    return { ok: false, error: "terminal sessions cannot receive more messages", session };
  }

  if (message.messageType === "Offer") {
    if (session.currentState !== "awaiting_buyer_offer" || message.sender !== session.buyerAgentId) {
      return { ok: false, error: "Offer is only valid as the buyer's opening message", session };
    }

    return {
      ok: true,
      session: {
        ...session,
        currentRound: (message.payload as OfferPayload).round,
        currentState: "awaiting_seller_response",
        messageHistory: [...session.messageHistory, message],
      },
    };
  }

  if (message.messageType === "CounterOffer") {
    const payload = message.payload as OfferPayload;
    const isSellerTurn =
      session.currentState === "awaiting_seller_response" && message.sender === session.sellerAgentId;
    const isBuyerTurn =
      session.currentState === "awaiting_buyer_response" && message.sender === session.buyerAgentId;

    if (!isSellerTurn && !isBuyerTurn) {
      return { ok: false, error: "CounterOffer was sent out of turn", session };
    }

    if (payload.round > session.maxRounds) {
      return { ok: false, error: "CounterOffer exceeds max rounds", session };
    }

    return {
      ok: true,
      session: {
        ...session,
        currentRound: payload.round,
        currentState: isSellerTurn ? "awaiting_buyer_response" : "awaiting_seller_response",
        messageHistory: [...session.messageHistory, message],
      },
    };
  }

  if (message.messageType === "Accept") {
    const isSellerTurn =
      session.currentState === "awaiting_seller_response" && message.sender === session.sellerAgentId;
    const isBuyerTurn =
      session.currentState === "awaiting_buyer_response" && message.sender === session.buyerAgentId;

    if (!isSellerTurn && !isBuyerTurn) {
      return { ok: false, error: "Accept was sent out of turn", session };
    }

    return {
      ok: true,
      session: {
        ...session,
        messageHistory: [...session.messageHistory, message],
      },
    };
  }

  if (message.messageType === "Agreement") {
    return {
      ok: true,
      session: {
        ...session,
        currentState: "agreement",
        messageHistory: [...session.messageHistory, message],
      },
    };
  }

  if (message.messageType === "Reject" || message.messageType === "NoDeal") {
    return {
      ok: true,
      session: {
        ...session,
        currentState: "no_deal",
        messageHistory: [...session.messageHistory, message],
      },
    };
  }

  return { ok: false, error: "unknown message type", session };
}

export function applyProtocolMessage(session: NegotiationSession, message: ProtocolMessage): TransitionResult {
  if ("round" in message.payload) {
    const validation = validateOfferPayload(message.payload);
    if (!validation.ok) {
      return { ok: false, error: validation.errors.join("; "), session };
    }

    if (message.payload.negotiationId !== session.negotiationId) {
      return { ok: false, error: "message negotiationId does not match session", session };
    }
  }

  return nextStateForMessage(session, message);
}

function explainPolicyDecision(policy: SellerPolicy, finalOffer: OfferPayload): PolicyExplanation {
  const constraintsApplied: string[] = [];
  const finalPolicyFloor = sellerMinimumAcceptablePrice(finalOffer, policy);

  if (finalOffer.deliveryDays < policy.standardDeliveryDays) {
    constraintsApplied.push(`Rush fee considered: ${policy.rushFee} ${policy.currency}`);
  }
  if (finalOffer.bundleItems.length > 1) {
    constraintsApplied.push(`Bundle discount considered: ${policy.bundleDiscount} ${policy.currency}`);
  }
  if (finalOffer.recurringClient) {
    constraintsApplied.push(`Recurring client discount considered: ${policy.recurringClientDiscount} ${policy.currency}`);
  }
  constraintsApplied.push(`Payment schedule matched: ${policy.preferredPaymentSchedule}`);
  constraintsApplied.push(`Workload available: ${policy.currentWorkload}/${policy.maximumWorkload}`);
  constraintsApplied.push(`Final price stayed above policy floor: ${finalPolicyFloor} ${policy.currency}`);

  return {
    acceptedBecause: "The final offer satisfied seller price floor, workload capacity, delivery timing, and payment schedule constraints.",
    constraintsApplied,
    finalPolicyFloor,
    buyerSavingsVsSellerPreferred: Math.max(0, policy.preferredPrice - finalOffer.price),
  };
}

/**
 * Synthesizes the Agreement record for an offer that was just accepted.
 * Only the party holding the seller's policy (Parley's registry, or the
 * seller's own process) can honestly compute policyExplanation, since it
 * requires the seller's private floor/preferred price.
 */
export function createAgreement(
  request: ServiceRequest,
  policy: SellerPolicy,
  session: NegotiationSession,
  finalOffer: OfferMessage,
  reason: string,
  platformKeyPair?: { publicKey: string; privateKey: KeyObject },
): AgreementMessage {
  const payload: AgreementPayload = {
    agreementId: id("agreement"),
    negotiationId: session.negotiationId,
    buyerAgentId: request.buyerAgentId,
    sellerAgentId: policy.sellerAgentId,
    service: request.service,
    finalOffer: finalOffer.payload,
    acceptedAt: nowIso(),
    expiresAt: finalOffer.payload.expiresAt,
    roundsUsed: session.currentRound,
    savings: Math.max(0, policy.preferredPrice - finalOffer.payload.price),
    reason,
    policyExplanation: explainPolicyDecision(policy, finalOffer.payload),
  };

  if (platformKeyPair) {
    payload.platformAttestation = {
      publicKey: platformKeyPair.publicKey,
      signature: signPayload(
        { agreementId: payload.agreementId, negotiationId: payload.negotiationId, finalOffer: payload.finalOffer, policyExplanation: payload.policyExplanation },
        platformKeyPair.privateKey,
      ),
    };
  }

  return {
    id: id("agreement"),
    sender: policy.sellerAgentId,
    receiver: request.buyerAgentId,
    timestamp: nowIso(),
    messageType: "Agreement",
    payload,
  };
}

function appendOrThrow(session: NegotiationSession, message: ProtocolMessage): NegotiationSession {
  const transition = applyProtocolMessage(session, message);

  if (!transition.ok) {
    throw new Error(transition.error);
  }

  return transition.session;
}

function lastOfferInHistory(session: NegotiationSession): OfferMessage {
  const offer = [...session.messageHistory]
    .reverse()
    .find((message): message is OfferMessage => message.messageType === "Offer" || message.messageType === "CounterOffer");

  if (!offer) {
    throw new Error("session does not contain an offer");
  }

  return offer;
}

function finishNoDeal(session: NegotiationSession, sender: string, receiver: string, reason: string): NegotiationResult {
  const noDeal = buildNoDealMessage(sender, receiver, session, reason);
  const finalSession = appendOrThrow(session, noDeal);

  return { session: finalSession, noDeal };
}

function finishAgreement(
  session: NegotiationSession,
  request: ServiceRequest,
  policy: SellerPolicy,
  acceptedOffer: OfferMessage,
  acceptSender: string,
  acceptReceiver: string,
  reason: string,
  platformKeyPair?: { publicKey: string; privateKey: KeyObject },
): NegotiationResult {
  const accept = buildAcceptMessage(acceptSender, acceptReceiver, session.negotiationId, acceptedOffer.id, reason);
  let nextSession = appendOrThrow(session, accept);

  const agreement = createAgreement(request, policy, nextSession, acceptedOffer, reason, platformKeyPair);
  nextSession = appendOrThrow(nextSession, agreement);

  return { session: nextSession, agreement };
}

/**
 * Reference one-shot simulation: resolves an entire negotiation synchronously
 * using the same decideSellerMove/decideBuyerMove primitives a standalone
 * agent process would call one HTTP round-trip at a time. Kept for fast
 * demos and tests; not the only way to drive a negotiation — see
 * src/api/negotiate-service.ts's open/message flow for the turn-by-turn path.
 *
 * platformKeyPair, if given, is used to attest the resulting Agreement (see
 * AgreementPayload.platformAttestation) — this path doesn't sign individual
 * Offer/CounterOffer messages, since it's a self-contained simulation, not a
 * real exchange between two key-holding processes.
 */
export function runNegotiation(
  request: ServiceRequest,
  policy: SellerPolicy,
  platformKeyPair?: { publicKey: string; privateKey: KeyObject },
): NegotiationResult {
  const requestValidation = validateServiceRequest(request);
  const policyValidation = validateSellerPolicy(policy);
  let session = createNegotiationSession(request, policy);

  if (!requestValidation.ok) {
    return finishNoDeal(session, request.buyerAgentId, policy.sellerAgentId, requestValidation.errors.join("; "));
  }

  if (!policyValidation.ok) {
    return finishNoDeal(session, policy.sellerAgentId, request.buyerAgentId, policyValidation.errors.join("; "));
  }

  session = appendOrThrow(session, createOpeningOffer(request, session.negotiationId, session.sellerAgentId));

  while (session.currentState !== "agreement" && session.currentState !== "no_deal") {
    if (session.currentState === "awaiting_seller_response") {
      const offer = lastOfferInHistory(session);
      const move = decideSellerMove(policy, session, offer);

      if (move.type === "accept") {
        return finishAgreement(session, request, policy, offer, policy.sellerAgentId, request.buyerAgentId, move.reason, platformKeyPair);
      }

      if (move.type === "walk") {
        return finishNoDeal(session, policy.sellerAgentId, request.buyerAgentId, move.reason);
      }

      session = appendOrThrow(session, move.message);
    }

    if (session.currentState === "awaiting_buyer_response") {
      const offer = lastOfferInHistory(session);
      const move = decideBuyerMove(request, session, offer);

      if (move.type === "accept") {
        return finishAgreement(session, request, policy, offer, request.buyerAgentId, policy.sellerAgentId, move.reason, platformKeyPair);
      }

      if (move.type === "walk") {
        return finishNoDeal(session, request.buyerAgentId, policy.sellerAgentId, move.reason);
      }

      session = appendOrThrow(session, move.message);
    }
  }

  return { session };
}
