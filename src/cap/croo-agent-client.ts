import type {
  AcceptNegotiationResult,
  DeliverOrderRequest,
  DeliverOrderResult,
  Delivery,
  EventStream,
  NegotiateOrderRequest,
  Negotiation,
  Order,
  PayOrderResult,
} from "@croo-network/sdk";

/**
 * The subset of `AgentClient` the settlement adapter depends on. Narrowing to
 * an interface lets tests inject fakes instead of hitting the live CAP network.
 * `connectWebSocket` is optional so existing fakes (and any client that never
 * needs it) don't have to implement it.
 */
export interface CROOAgentClient {
  negotiateOrder(req: NegotiateOrderRequest): Promise<Negotiation>;
  acceptNegotiationWithFundAddress(negotiationId: string, providerFundAddress: string): Promise<AcceptNegotiationResult>;
  getOrder(orderId: string): Promise<Order>;
  payOrder(orderId: string): Promise<PayOrderResult>;
  deliverOrder(orderId: string, req: DeliverOrderRequest): Promise<DeliverOrderResult>;
  getDelivery(orderId: string): Promise<Delivery>;
  connectWebSocket?(): Promise<EventStream>;
}
