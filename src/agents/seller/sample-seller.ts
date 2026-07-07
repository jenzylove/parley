import { generateAgentKeyPair } from "@/core/parley-core/negotiation/signing";
import type { SellerPolicy } from "@/core/parley-core";

// Placeholder identity for this fixture. Any real agent (see
// run-seller-agent.ts) generates and holds its own keypair instead of
// reusing this one — signatures made with it don't represent this seller's
// actual consent.
export const sampleSellerPolicy: SellerPolicy = {
  sellerAgentId: "seller-agent-copywriter",
  publicKey: generateAgentKeyPair().publicKey,
  service: "Launch landing page copy",
  currency: "USDC",
  minimumPrice: 1.5,
  preferredPrice: 2.5,
  standardDeliveryDays: 5,
  rushFee: 0.5,
  bundleDiscount: 0.5,
  recurringClientDiscount: 0.2,
  maximumWorkload: 6,
  currentWorkload: 3,
  preferredPaymentSchedule: "upfront",
  maxRounds: 3,
};
