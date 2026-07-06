import type {
  AcceptPayload,
  AgreementMessage,
  AgreementPayload,
  AgentId,
  NegotiationResult,
  NegotiationSession,
  NoDealMessage,
  NoDealPayload,
  OfferMessage,
  OfferPayload,
  PolicyExplanation,
  ProtocolMessage,
  ProtocolPayload,
  SellerPolicy,
  ServiceRequest,
  TransitionResult,
} from "./types";
import {
  sellerMinimumAcceptablePrice,
  validateOfferAgainstPolicy,
  validateOfferPayload,
  validateSellerPolicy,
  validateServiceRequest,
} from "./validation";

const nowIso = () => new Date().toISOString();

const expiresInMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

function createMessage<TPayload extends ProtocolPayload>(
  messageType: ProtocolMessage<TPayload>["messageType"],
  sender: AgentId,
  receiver: AgentId,
  payload: TPayload,
): ProtocolMessage<TPayload> {
  return {
    id: id(messageType.toLowerCase()),
    sender,
    receiver,
    timestamp: nowIso(),
    messageType,
    payload,
  };
}

export function createNegotiationSession(request: ServiceRequest, policy: SellerPolicy): NegotiationSession {
  return {
    negotiationId: id("negotiation"),
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

function createOfferPayload(
  negotiationId: string,
  price: number,
  request: ServiceRequest,
  deliveryDays: number,
  round: number,
): OfferPayload {
  return {
    negotiationId,
    price,
    currency: request.currency,
    deliveryDays,
    bundleItems: request.requestedItems,
    paymentSchedule: "upfront",
    expiresAt: expiresInMinutes(30),
    round,
  };
}

function createOpeningOffer(request: ServiceRequest, session: NegotiationSession): OfferMessage {
  return createMessage(
    "Offer",
    request.buyerAgentId,
    session.sellerAgentId,
    createOfferPayload(
      session.negotiationId,
      request.targetPrice,
      request,
      request.desiredDeliveryDays,
      1,
    ),
  ) as OfferMessage;
}

function createSellerCounteroffer(
  request: ServiceRequest,
  policy: SellerPolicy,
  session: NegotiationSession,
  lastOffer: OfferPayload,
): OfferMessage {
  const rushPrice = lastOffer.deliveryDays < policy.standardDeliveryDays ? policy.rushFee : 0;
  const discount = request.requestedItems.length > 1 ? policy.bundleDiscount : 0;
  const recurringDiscount = request.recurringClient ? policy.recurringClientDiscount : 0;
  const askPrice = Math.max(policy.minimumPrice, policy.preferredPrice + rushPrice - discount - recurringDiscount);

  return createMessage(
    "CounterOffer",
    policy.sellerAgentId,
    request.buyerAgentId,
    createOfferPayload(
      session.negotiationId,
      askPrice,
      request,
      Math.max(lastOffer.deliveryDays, policy.standardDeliveryDays),
      session.currentRound + 1,
    ),
  ) as OfferMessage;
}

function createBuyerCounteroffer(
  request: ServiceRequest,
  session: NegotiationSession,
  lastSellerOffer: OfferPayload,
): OfferMessage {
  const remainingGap = Math.max(0, request.maxPrice - request.targetPrice);
  const concession = Math.ceil(remainingGap / Math.max(1, session.maxRounds - 1));
  const nextPrice = Math.min(request.maxPrice, Math.max(request.targetPrice + concession * session.currentRound, lastSellerOffer.price - concession));

  return createMessage(
    "CounterOffer",
    request.buyerAgentId,
    session.sellerAgentId,
    createOfferPayload(
      session.negotiationId,
      nextPrice,
      request,
      lastSellerOffer.deliveryDays,
      session.currentRound + 1,
    ),
  ) as OfferMessage;
}

function createAccept(sender: AgentId, receiver: AgentId, negotiationId: string, acceptedMessageId: string, reason: string) {
  const payload: AcceptPayload = { negotiationId, acceptedMessageId, reason };

  return createMessage("Accept", sender, receiver, payload);
}

function explainPolicyDecision(request: ServiceRequest, policy: SellerPolicy, finalOffer: OfferPayload): PolicyExplanation {
  const constraintsApplied: string[] = [];
  const finalPolicyFloor = sellerMinimumAcceptablePrice(finalOffer, policy, request.recurringClient);

  if (finalOffer.deliveryDays < policy.standardDeliveryDays) {
    constraintsApplied.push(`Rush fee considered: ${policy.rushFee} ${policy.currency}`);
  }
  if (finalOffer.bundleItems.length > 1) {
    constraintsApplied.push(`Bundle discount considered: ${policy.bundleDiscount} ${policy.currency}`);
  }
  if (request.recurringClient) {
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

function createAgreement(
  request: ServiceRequest,
  policy: SellerPolicy,
  session: NegotiationSession,
  finalOffer: OfferMessage,
  reason: string,
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
    policyExplanation: explainPolicyDecision(request, policy, finalOffer.payload),
  };

  return createMessage("Agreement", policy.sellerAgentId, request.buyerAgentId, payload) as AgreementMessage;
}

function createNoDeal(
  sender: AgentId,
  receiver: AgentId,
  session: NegotiationSession,
  reason: string,
): NoDealMessage {
  const payload: NoDealPayload = {
    negotiationId: session.negotiationId,
    reason,
    finalRound: session.currentRound,
  };

  return createMessage("NoDeal", sender, receiver, payload) as NoDealMessage;
}

function appendOrThrow(session: NegotiationSession, message: ProtocolMessage): NegotiationSession {
  const transition = applyProtocolMessage(session, message);

  if (!transition.ok) {
    throw new Error(transition.error);
  }

  return transition.session;
}

function lastOffer(session: NegotiationSession): OfferMessage {
  const offer = [...session.messageHistory]
    .reverse()
    .find((message): message is OfferMessage => message.messageType === "Offer" || message.messageType === "CounterOffer");

  if (!offer) {
    throw new Error("session does not contain an offer");
  }

  return offer;
}

function finishNoDeal(session: NegotiationSession, sender: AgentId, receiver: AgentId, reason: string): NegotiationResult {
  const noDeal = createNoDeal(sender, receiver, session, reason);
  const finalSession = appendOrThrow(session, noDeal);

  return { session: finalSession, noDeal };
}

export function runNegotiation(request: ServiceRequest, policy: SellerPolicy): NegotiationResult {
  const requestValidation = validateServiceRequest(request);
  const policyValidation = validateSellerPolicy(policy);
  let session = createNegotiationSession(request, policy);

  if (!requestValidation.ok) {
    return finishNoDeal(session, request.buyerAgentId, policy.sellerAgentId, requestValidation.errors.join("; "));
  }

  if (!policyValidation.ok) {
    return finishNoDeal(session, policy.sellerAgentId, request.buyerAgentId, policyValidation.errors.join("; "));
  }

  session = appendOrThrow(session, createOpeningOffer(request, session));

  while (session.currentState !== "agreement" && session.currentState !== "no_deal") {
    const offer = lastOffer(session);

    if (session.currentState === "awaiting_seller_response") {
      const policyCheck = validateOfferAgainstPolicy(offer.payload, policy, request.recurringClient);

      if (policyCheck.ok) {
        const accept = createAccept(
          policy.sellerAgentId,
          request.buyerAgentId,
          session.negotiationId,
          offer.id,
          "Offer satisfies seller policy constraints.",
        );
        session = appendOrThrow(session, accept);

        const agreement = createAgreement(request, policy, session, offer, accept.payload.reason);
        session = appendOrThrow(session, agreement);

        return { session, agreement };
      }

      if (session.currentRound >= session.maxRounds) {
        return finishNoDeal(
          session,
          policy.sellerAgentId,
          request.buyerAgentId,
          "Maximum negotiation rounds reached before seller could make a valid counteroffer.",
        );
      }

      session = appendOrThrow(session, createSellerCounteroffer(request, policy, session, offer.payload));
    }

    if (session.currentState === "awaiting_buyer_response") {
      const sellerOffer = lastOffer(session);
      const buyerCanAccept =
        sellerOffer.payload.price <= request.maxPrice &&
        sellerOffer.payload.deliveryDays >= request.desiredDeliveryDays;

      if (buyerCanAccept) {
        const accept = createAccept(
          request.buyerAgentId,
          policy.sellerAgentId,
          session.negotiationId,
          sellerOffer.id,
          "Counteroffer is within buyer price and delivery constraints.",
        );
        session = appendOrThrow(session, accept);

        const agreement = createAgreement(request, policy, session, sellerOffer, accept.payload.reason);
        session = appendOrThrow(session, agreement);

        return { session, agreement };
      }

      const minimumAcceptable = sellerMinimumAcceptablePrice(sellerOffer.payload, policy, request.recurringClient);
      if (session.currentRound >= session.maxRounds || request.maxPrice < minimumAcceptable) {
        return finishNoDeal(
          session,
          request.buyerAgentId,
          policy.sellerAgentId,
          request.maxPrice < minimumAcceptable
            ? "Buyer maximum price cannot satisfy seller policy constraints."
            : "Maximum negotiation rounds reached before buyer could accept.",
        );
      }

      session = appendOrThrow(session, createBuyerCounteroffer(request, session, sellerOffer.payload));
    }
  }

  return { session };
}
