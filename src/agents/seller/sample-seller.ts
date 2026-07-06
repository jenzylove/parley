import type { SellerPolicy } from "@/core/parley-core";

export const sampleSellerPolicy: SellerPolicy = {
  sellerAgentId: "seller-agent-copywriter",
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
