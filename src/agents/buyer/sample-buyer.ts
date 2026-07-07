import { generateAgentKeyPair } from "@/core/parley-core/negotiation/signing";
import type { ServiceRequest } from "@/core/parley-core";

// Placeholder identity for this fixture. Any real agent (see
// run-buyer-agent.ts) generates and holds its own keypair instead of reusing
// this one — signatures made with it don't represent a real buyer's consent.
export const sampleBuyerRequest: ServiceRequest = {
  id: "request_brand_kit_001",
  buyerAgentId: "buyer-agent-demo",
  buyerPublicKey: generateAgentKeyPair().publicKey,
  service: "Launch landing page copy",
  requestedItems: ["headline set", "feature bullets", "pricing FAQ"],
  targetPrice: 2,
  maxPrice: 3,
  currency: "USDC",
  desiredDeliveryDays: 3,
  recurringClient: true,
};
