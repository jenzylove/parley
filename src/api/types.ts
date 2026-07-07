import type { ExplainedProtocolMessage } from "@/ai/types";
import type {
  CommerceOrder,
  LockedTerms,
  MarketIntelligence,
  NegotiationResult,
  NegotiationSession,
  OfferMessage,
  ProtocolMessage,
  PublicSellerTerms,
  SellerPolicy,
  ServiceRequest,
} from "@/core/parley-core";

export type VersionedResponse<T> = T & {
  protocolVersion: string;
};

export type StartNegotiationRequest = {
  request: ServiceRequest;
  sellerAgentId: string;
};

export type NegotiationResponse = VersionedResponse<{
  result: NegotiationResult;
  commerce: {
    order: CommerceOrder;
    lockedTerms?: LockedTerms;
  };
  market: MarketIntelligence;
  explanations: ExplainedProtocolMessage[];
}>;

export type OpenNegotiationRequest = {
  request: ServiceRequest;
  sellerAgentId: string;
  /**
   * The buyer's opening Offer, already built and signed by the buyer's own
   * process (see strategy.ts's createOpeningOffer). Parley never constructs
   * this on the buyer's behalf — that would mean the "buyer's" first move
   * wasn't actually authored (or signable) by the buyer at all.
   */
  openingOffer: OfferMessage;
};

export type OpenNegotiationResponse = VersionedResponse<{
  session: NegotiationSession;
}>;

export type MessageNegotiationRequest = {
  negotiationId: string;
  message: ProtocolMessage;
};

export type MessageNegotiationResponse = VersionedResponse<{
  session: NegotiationSession;
  commerce?: {
    order: CommerceOrder;
    lockedTerms?: LockedTerms;
  };
  market?: MarketIntelligence;
}>;

export type RegisterSellerRequest = SellerPolicy;

export type RegisterSellerResponse = VersionedResponse<{
  sellerAgentId: string;
}>;

export type ListSellersResponse = VersionedResponse<{
  sellers: PublicSellerTerms[];
}>;

export type PendingForSellerResponse = VersionedResponse<{
  sellerAgentId: string;
  negotiationIds: string[];
}>;

export type SessionResponse = VersionedResponse<{
  session: NegotiationSession;
  commerce?: {
    order: CommerceOrder;
    lockedTerms?: LockedTerms;
  };
  market?: MarketIntelligence;
}>;

export type HistoryResponse = VersionedResponse<{
  negotiationId: string;
  messageHistory: ProtocolMessage[];
}>;

export type ErrorResponse = VersionedResponse<{
  error: string;
}>;
