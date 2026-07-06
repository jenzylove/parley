import type { ServiceRequest } from "@/core/parley-core";

export const sampleBuyerRequest: ServiceRequest = {
  id: "request_brand_kit_001",
  buyerAgentId: "buyer-agent-demo",
  service: "Launch landing page copy",
  requestedItems: ["headline set", "feature bullets", "pricing FAQ"],
  targetPrice: 46,
  maxPrice: 58,
  currency: "USDC",
  desiredDeliveryDays: 3,
  recurringClient: true,
};
