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

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export type TransitionResult =
  | { ok: true; session: NegotiationSession }
  | { ok: false; error: string; session: NegotiationSession };
