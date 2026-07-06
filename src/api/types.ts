import type { ExplainedProtocolMessage } from "@/ai/types";
import type {
  CommerceOrder,
  LockedTerms,
  MarketIntelligence,
  NegotiationResult,
  NegotiationSession,
  ProtocolMessage,
  SellerPolicy,
  ServiceRequest,
} from "@/core/parley-core";

export type VersionedResponse<T> = T & {
  protocolVersion: string;
};

export type StartNegotiationRequest = {
  request: ServiceRequest;
  policy: SellerPolicy;
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
