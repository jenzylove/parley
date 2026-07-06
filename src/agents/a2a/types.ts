import type { HistoryResponse, NegotiationResponse, SessionResponse } from "@/api/types";
import type { ProtocolMessage, SellerPolicy, ServiceRequest } from "@/core/parley-core";

export type AgentIdentity = {
  agentId: string;
  role: "buyer" | "seller" | "observer";
};

export type ObserverSummary = {
  observerAgentId: string;
  negotiationId: string;
  messageCount: number;
  messageTypes: string[];
  finalState: string;
  summary: string;
};

export type A2ADemoResult = {
  buyerAgent: AgentIdentity;
  sellerAgent: AgentIdentity;
  observerAgent: AgentIdentity;
  request: ServiceRequest;
  sellerPolicy: SellerPolicy;
  negotiation: NegotiationResponse;
  session: SessionResponse;
  history: HistoryResponse;
  observerSummary: ObserverSummary;
};

export type A2ADemoResponse = {
  protocolVersion: string;
  demo: A2ADemoResult;
};

export type ParleyApiClient = {
  startNegotiation(request: ServiceRequest, policy: SellerPolicy): Promise<NegotiationResponse>;
  getSession(negotiationId: string): Promise<SessionResponse>;
  getHistory(negotiationId: string): Promise<HistoryResponse>;
};

export type WatchedProtocolMessage = ProtocolMessage;
