import { describe, expect, it } from "vitest";
import { sampleBuyerRequest } from "../agents/buyer/sample-buyer";
import { sampleSellerPolicy } from "../agents/seller/sample-seller";
import { runNegotiation, toPublicSellerTerms } from "../core/parley-core";
import { createPublicNegotiationContext } from "./explanation-layer";

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

  it("exposes only public, price-free seller terms for discovery", () => {
    const publicTerms = toPublicSellerTerms(sampleSellerPolicy);
    const serialized = JSON.stringify(publicTerms);

    expect(publicTerms).toEqual({
      sellerAgentId: sampleSellerPolicy.sellerAgentId,
      service: sampleSellerPolicy.service,
      currency: sampleSellerPolicy.currency,
      standardDeliveryDays: sampleSellerPolicy.standardDeliveryDays,
      maxRounds: sampleSellerPolicy.maxRounds,
    });
    expect(serialized).not.toContain("minimumPrice");
    expect(serialized).not.toContain("preferredPrice");
    expect(serialized).not.toContain(String(sampleSellerPolicy.minimumPrice));
    expect(serialized).not.toContain(String(sampleSellerPolicy.preferredPrice));
  });
});
