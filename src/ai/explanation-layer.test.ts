import { describe, expect, it } from "vitest";
import { sampleBuyerRequest } from "../agents/buyer/sample-buyer";
import { sampleSellerPolicy } from "../agents/seller/sample-seller";
import { runNegotiation } from "../core/parley-core";
import { createPublicNegotiationContext, createPublicSellerTerms } from "./explanation-layer";

describe("AI explanation layer safety", () => {
  it("does not include seller private price constraints in public context", () => {
    const result = runNegotiation(sampleBuyerRequest, sampleSellerPolicy);
    const publicContext = createPublicNegotiationContext(result, sampleBuyerRequest, sampleSellerPolicy);
    const serialized = JSON.stringify(publicContext);

    expect(serialized).not.toContain("minimumPrice");
    expect(serialized).not.toContain("preferredPrice");
    expect(serialized).not.toContain(String(sampleSellerPolicy.minimumPrice));
    expect(serialized).not.toContain(String(sampleSellerPolicy.preferredPrice));
  });

  it("exposes only public seller terms for display", () => {
    expect(createPublicSellerTerms(sampleSellerPolicy)).toEqual({
      service: sampleSellerPolicy.service,
      currency: sampleSellerPolicy.currency,
      minimumPrice: sampleSellerPolicy.minimumPrice,
      preferredPrice: sampleSellerPolicy.preferredPrice,
      standardDeliveryDays: sampleSellerPolicy.standardDeliveryDays,
      rushFee: sampleSellerPolicy.rushFee,
      bundleDiscount: sampleSellerPolicy.bundleDiscount,
      recurringClientDiscount: sampleSellerPolicy.recurringClientDiscount,
      maximumWorkload: sampleSellerPolicy.maximumWorkload,
      currentWorkload: sampleSellerPolicy.currentWorkload,
      preferredPaymentSchedule: sampleSellerPolicy.preferredPaymentSchedule,
      maxRounds: sampleSellerPolicy.maxRounds,
    });
  });
});
