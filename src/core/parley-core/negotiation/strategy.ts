import type { KeyObject } from "node:crypto";
import type {
  AcceptMessage,
  AcceptPayload,
  AgentId,
  Currency,
  NegotiationSession,
  NoDealMessage,
  NoDealPayload,
  OfferMessage,
  OfferPayload,
  ProtocolMessage,
  SellerPolicy,
  ServiceRequest,
} from "./types";
import { signMessage } from "./signing";
import { validateOfferAgainstPolicy } from "./validation";

function maybeSign<T extends ProtocolMessage>(message: Omit<T, "signature">, privateKey?: KeyObject): T {
  return privateKey ? signMessage(message, privateKey) : (message as T);
}

const nowIso = () => new Date().toISOString();
const expiresInMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

/**
 * Fields carried forward from the previous wire message so a counter-offer
 * never has to reach into the counterparty's private ServiceRequest/policy
 * object for continuity data (currency, bundle items). Only the opening
 * offer reads those directly from the buyer's own request, since that's the
 * one place the buyer chooses to disclose them.
 */
type WireContinuity = {
  currency: Currency;
  bundleItems: string[];
};

function buildOfferPayload(
  negotiationId: string,
  price: number,
  continuity: WireContinuity,
  deliveryDays: number,
  round: number,
  recurringClient: boolean,
): OfferPayload {
  return {
    negotiationId,
    price,
    currency: continuity.currency,
    deliveryDays,
    bundleItems: continuity.bundleItems,
    paymentSchedule: "upfront",
    expiresAt: expiresInMinutes(30),
    round,
    recurringClient,
  };
}

function buildOfferMessage(sender: AgentId, receiver: AgentId, payload: OfferPayload): OfferMessage {
  return {
    id: id("offer"),
    sender,
    receiver,
    timestamp: nowIso(),
    messageType: payload.round === 1 ? "Offer" : "CounterOffer",
    payload,
  } as OfferMessage;
}

/**
 * The buyer's opening move. Only place a ServiceRequest's private fields
 * legitimately cross onto the wire. Takes a bare negotiationId/sellerAgentId
 * rather than a full NegotiationSession — the buyer generates its own
 * negotiationId and signs this message entirely locally, before any session
 * exists on the server (it POSTs this already-built message to open one).
 */
export function createOpeningOffer(
  request: ServiceRequest,
  negotiationId: string,
  sellerAgentId: AgentId,
  privateKey?: KeyObject,
): OfferMessage {
  const payload = buildOfferPayload(
    negotiationId,
    request.targetPrice,
    { currency: request.currency, bundleItems: request.requestedItems },
    request.desiredDeliveryDays,
    1,
    request.recurringClient,
  );

  return maybeSign<OfferMessage>(buildOfferMessage(request.buyerAgentId, sellerAgentId, payload), privateKey);
}

export type SellerMove =
  | { type: "accept"; reason: string }
  | { type: "counter"; message: OfferMessage }
  | { type: "walk"; reason: string };

/**
 * Decides the seller's next move using only the seller's own policy and the
 * counterparty's last wire offer — nothing else. Callable identically by the
 * hosted negotiation service (for the one-shot demo path) or by a standalone
 * seller process that never shares its policy with anyone but Parley's
 * registry.
 */
export function decideSellerMove(
  policy: SellerPolicy,
  session: NegotiationSession,
  lastOffer: OfferMessage,
  privateKey?: KeyObject,
): SellerMove {
  const check = validateOfferAgainstPolicy(lastOffer.payload, policy);

  if (check.ok) {
    return { type: "accept", reason: "Offer satisfies seller policy constraints." };
  }

  if (session.currentRound >= session.maxRounds) {
    return { type: "walk", reason: "Maximum negotiation rounds reached before seller could make a valid counteroffer." };
  }

  const last = lastOffer.payload;
  const rushPrice = last.deliveryDays < policy.standardDeliveryDays ? policy.rushFee : 0;
  const discount = last.bundleItems.length > 1 ? policy.bundleDiscount : 0;
  const recurringDiscount = last.recurringClient ? policy.recurringClientDiscount : 0;
  const askPrice = Math.max(policy.minimumPrice, policy.preferredPrice + rushPrice - discount - recurringDiscount);

  const payload = buildOfferPayload(
    session.negotiationId,
    askPrice,
    { currency: last.currency, bundleItems: last.bundleItems },
    Math.max(last.deliveryDays, policy.standardDeliveryDays),
    session.currentRound + 1,
    last.recurringClient,
  );

  return {
    type: "counter",
    message: maybeSign<OfferMessage>(buildOfferMessage(policy.sellerAgentId, session.buyerAgentId, payload), privateKey),
  };
}

export type BuyerMove =
  | { type: "accept"; reason: string }
  | { type: "counter"; message: OfferMessage }
  | { type: "walk"; reason: string };

/**
 * Decides the buyer's next move using only the buyer's own request and the
 * counterparty's last wire offer. Deliberately does not know the seller's
 * reservation price — a real buyer can't either. It can only walk away once
 * rounds run out, not because it inferred the seller's floor is unreachable.
 */
export function decideBuyerMove(
  request: ServiceRequest,
  session: NegotiationSession,
  lastSellerOffer: OfferMessage,
  privateKey?: KeyObject,
): BuyerMove {
  const last = lastSellerOffer.payload;
  const canAccept = last.price <= request.maxPrice && last.deliveryDays >= request.desiredDeliveryDays;

  if (canAccept) {
    return { type: "accept", reason: "Counteroffer is within buyer price and delivery constraints." };
  }

  if (session.currentRound >= session.maxRounds) {
    return { type: "walk", reason: "Maximum negotiation rounds reached before buyer could accept." };
  }

  const remainingGap = Math.max(0, request.maxPrice - request.targetPrice);
  const concession = Math.ceil(remainingGap / Math.max(1, session.maxRounds - 1));
  const nextPrice = Math.min(
    request.maxPrice,
    Math.max(request.targetPrice + concession * session.currentRound, last.price - concession),
  );

  const payload = buildOfferPayload(
    session.negotiationId,
    nextPrice,
    { currency: last.currency, bundleItems: last.bundleItems },
    last.deliveryDays,
    session.currentRound + 1,
    last.recurringClient,
  );

  return {
    type: "counter",
    message: maybeSign<OfferMessage>(buildOfferMessage(request.buyerAgentId, session.sellerAgentId, payload), privateKey),
  };
}

export function buildAcceptMessage(
  sender: AgentId,
  receiver: AgentId,
  negotiationId: string,
  acceptedMessageId: string,
  reason: string,
  privateKey?: KeyObject,
): AcceptMessage {
  const payload: AcceptPayload = { negotiationId, acceptedMessageId, reason };

  return maybeSign<AcceptMessage>(
    {
      id: id("accept"),
      sender,
      receiver,
      timestamp: nowIso(),
      messageType: "Accept",
      payload,
    },
    privateKey,
  );
}

export function buildNoDealMessage(
  sender: AgentId,
  receiver: AgentId,
  session: NegotiationSession,
  reason: string,
  privateKey?: KeyObject,
): NoDealMessage {
  const payload: NoDealPayload = { negotiationId: session.negotiationId, reason, finalRound: session.currentRound };

  return maybeSign<NoDealMessage>(
    {
      id: id("nodeal"),
      sender,
      receiver,
      timestamp: nowIso(),
      messageType: "NoDeal",
      payload,
    },
    privateKey,
  );
}

/** Finds the exact offer a given Accept referenced, rather than assuming "the last one in history". */
export function findOfferById(session: NegotiationSession, messageId: string): OfferMessage {
  const offer = session.messageHistory.find(
    (message): message is OfferMessage => message.id === messageId && (message.messageType === "Offer" || message.messageType === "CounterOffer"),
  );

  if (!offer) {
    throw new Error(`No Offer/CounterOffer found with id ${messageId}`);
  }

  return offer;
}
