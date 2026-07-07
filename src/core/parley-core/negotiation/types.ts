export type Currency = "USDC";

export type AgentId = string;

export type MessageType = "Offer" | "CounterOffer" | "Accept" | "Reject" | "Agreement" | "NoDeal";

export type NegotiationState =
  | "awaiting_buyer_offer"
  | "awaiting_seller_response"
  | "awaiting_buyer_response"
  | "agreement"
  | "no_deal";

export type ServiceRequest = {
  id: string;
  buyerAgentId: AgentId;
  /** Base64 SPKI DER Ed25519 public key. Every message this buyer sends must verify against it. */
  buyerPublicKey: string;
  service: string;
  requestedItems: string[];
  targetPrice: number;
  maxPrice: number;
  currency: Currency;
  desiredDeliveryDays: number;
  recurringClient: boolean;
};

export type SellerPolicy = {
  sellerAgentId: AgentId;
  /** Base64 SPKI DER Ed25519 public key. Every message this seller sends must verify against it. */
  publicKey: string;
  service: string;
  currency: Currency;
  minimumPrice: number;
  preferredPrice: number;
  standardDeliveryDays: number;
  rushFee: number;
  bundleDiscount: number;
  recurringClientDiscount: number;
  maximumWorkload: number;
  currentWorkload: number;
  preferredPaymentSchedule: "upfront";
  maxRounds: number;
};

export type PolicyExplanation = {
  acceptedBecause: string;
  constraintsApplied: string[];
  finalPolicyFloor: number;
  buyerSavingsVsSellerPreferred: number;
};

export type OfferPayload = {
  negotiationId: string;
  price: number;
  currency: Currency;
  deliveryDays: number;
  bundleItems: string[];
  paymentSchedule: "upfront";
  expiresAt: string;
  round: number;
  /**
   * Self-declared by the buyer on the wire (set once, on the opening offer).
   * Carried on every subsequent payload so a seller's counter-offer strategy
   * never needs out-of-band access to the buyer's private ServiceRequest.
   */
  recurringClient: boolean;
};

export type AcceptPayload = {
  negotiationId: string;
  acceptedMessageId: string;
  reason: string;
};

export type RejectPayload = {
  negotiationId: string;
  rejectedMessageId: string;
  reason: string;
};

/**
 * Cryptographic proof that Parley's own negotiation service — not either
 * counterparty — computed this agreement's policyExplanation from the
 * seller's registered policy. Necessary because only the trusted registry
 * holding that policy can honestly derive it; the seller's own signature
 * would attest nothing an outside verifier could check the floor/preferred
 * price against.
 */
export type PlatformAttestation = {
  publicKey: string;
  signature: string;
};

export type AgreementPayload = {
  agreementId: string;
  negotiationId: string;
  buyerAgentId: AgentId;
  sellerAgentId: AgentId;
  service: string;
  finalOffer: OfferPayload;
  acceptedAt: string;
  expiresAt: string;
  roundsUsed: number;
  savings: number;
  reason: string;
  policyExplanation: PolicyExplanation;
  platformAttestation?: PlatformAttestation;
};

export type NoDealPayload = {
  negotiationId: string;
  reason: string;
  finalRound: number;
};

export type ProtocolPayload =
  | OfferPayload
  | AcceptPayload
  | RejectPayload
  | AgreementPayload
  | NoDealPayload;

export type ProtocolMessage<TPayload extends ProtocolPayload = ProtocolPayload> = {
  id: string;
  sender: AgentId;
  receiver: AgentId;
  timestamp: string;
  messageType: MessageType;
  payload: TPayload;
  /** Base64 Ed25519 signature over the message (see negotiation/signing.ts), verifying it actually came from `sender`. */
  signature?: string;
};

export type OfferMessage = ProtocolMessage<OfferPayload> & {
  messageType: "Offer" | "CounterOffer";
};

export type AcceptMessage = ProtocolMessage<AcceptPayload> & {
  messageType: "Accept";
};

export type AgreementMessage = ProtocolMessage<AgreementPayload> & {
  messageType: "Agreement";
};

export type NoDealMessage = ProtocolMessage<NoDealPayload> & {
  messageType: "NoDeal";
};

export type NegotiationSession = {
  negotiationId: string;
  buyerAgentId: AgentId;
  sellerAgentId: AgentId;
  currentRound: number;
  maxRounds: number;
  currentState: NegotiationState;
  messageHistory: ProtocolMessage[];
  createdAt: string;
};

export type NegotiationResult = {
  session: NegotiationSession;
  agreement?: AgreementMessage;
  noDeal?: NoDealMessage;
};

/**
 * What a seller may safely publish about its policy for discovery — no
 * price fields, since minimumPrice/preferredPrice are the reservation
 * price a negotiation exists to protect.
 */
export type PublicSellerTerms = {
  sellerAgentId: AgentId;
  service: string;
  currency: Currency;
  standardDeliveryDays: number;
  maxRounds: number;
};

export function toPublicSellerTerms(policy: SellerPolicy): PublicSellerTerms {
  return {
    sellerAgentId: policy.sellerAgentId,
    service: policy.service,
    currency: policy.currency,
    standardDeliveryDays: policy.standardDeliveryDays,
    maxRounds: policy.maxRounds,
  };
}

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export type TransitionResult =
  | { ok: true; session: NegotiationSession }
  | { ok: false; error: string; session: NegotiationSession };
