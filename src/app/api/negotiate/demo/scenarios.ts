import { generateAgentKeyPair } from "@/core/parley-core/negotiation/signing";
import type { SellerPolicy, ServiceRequest } from "@/core/parley-core";
import type { ScenarioKey } from "./scenario-labels";

/**
 * A distinct seller identity from the real CAP-integrated demo agents
 * (sample-seller.ts), used only by the interactive scenario picker on the
 * homepage. Kept separate so the free/instant mock-settled UI demo never
 * shares state with — or accidentally collides with — the agent identities
 * used for genuine on-chain settlement. This scenario picker doesn't sign
 * individual messages (it's the one-shot reference simulation, not two
 * key-holding processes), so the key here only exists to satisfy the
 * protocol's required identity field.
 */
export const demoSellerPolicy: SellerPolicy = {
  sellerAgentId: "seller-agent-theater-demo",
  publicKey: generateAgentKeyPair().publicKey,
  service: "Launch landing page copy",
  currency: "USDC",
  minimumPrice: 44,
  preferredPrice: 64,
  standardDeliveryDays: 5,
  rushFee: 8,
  bundleDiscount: 10,
  recurringClientDiscount: 4,
  maximumWorkload: 6,
  currentWorkload: 3,
  preferredPaymentSchedule: "upfront",
  maxRounds: 3,
};

const theaterBuyerPublicKey = generateAgentKeyPair().publicKey;

function baseRequest(overrides: Partial<ServiceRequest>): ServiceRequest {
  return {
    id: `request_theater_${Math.random().toString(36).slice(2, 10)}`,
    buyerAgentId: "buyer-agent-theater-demo",
    buyerPublicKey: theaterBuyerPublicKey,
    service: "Launch landing page copy",
    requestedItems: ["headline set"],
    targetPrice: 40,
    maxPrice: 58,
    currency: "USDC",
    desiredDeliveryDays: 5,
    recurringClient: false,
    ...overrides,
  };
}

export function buildScenarioRequest(scenario: ScenarioKey): ServiceRequest {
  switch (scenario) {
    case "balanced":
      return baseRequest({ targetPrice: 40, maxPrice: 58, desiredDeliveryDays: 5, requestedItems: ["headline set"] });

    case "bundle-recurring":
      return baseRequest({
        targetPrice: 40,
        maxPrice: 58,
        desiredDeliveryDays: 5,
        requestedItems: ["headline set", "feature bullets", "pricing FAQ"],
        recurringClient: true,
      });

    case "rush":
      // Priced to clear the seller's rush-inflated floor on the buyer's very
      // first offer, so the accepted offer is the one that actually carries
      // the rush delivery window — otherwise the seller's counter-offer
      // continuity normalizes deliveryDays back to standard once countered,
      // and the rush-fee line wouldn't show up in the constraints explanation.
      return baseRequest({
        targetPrice: 55,
        maxPrice: 70,
        desiredDeliveryDays: 2,
        requestedItems: ["headline set"],
      });

    case "no-deal":
      return baseRequest({ targetPrice: 20, maxPrice: 24, desiredDeliveryDays: 5, requestedItems: ["headline set"] });
  }
}
