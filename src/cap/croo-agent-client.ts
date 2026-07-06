import type {
  AcceptNegotiationResult,
  DeliverOrderRequest,
  DeliverOrderResult,
  Delivery,
  NegotiateOrderRequest,
  Negotiation,
  PayOrderResult,
} from "@croo-network/sdk";

/**
 * The subset of `AgentClient` the settlement adapter depends on. Narrowing to
 * an interface lets tests inject fakes instead of hitting the live CAP network.
 */
export interface CROOAgentClient {
  negotiateOrder(req: NegotiateOrderRequest): Promise<Negotiation>;
  acceptNegotiationWithFundAddress(negotiationId: string, providerFundAddress: string): Promise<AcceptNegotiationResult>;
  payOrder(orderId: string): Promise<PayOrderResult>;
  deliverOrder(orderId: string, req: DeliverOrderRequest): Promise<DeliverOrderResult>;
  getDelivery(orderId: string): Promise<Delivery>;
}
