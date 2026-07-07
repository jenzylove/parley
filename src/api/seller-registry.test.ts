import { beforeEach, describe, expect, it } from "vitest";
import { sampleSellerPolicy } from "../agents/seller/sample-seller";
import { clearSellerRegistryForTests, getSellerPolicy, listPublicSellers, registerSellerPolicy } from "./seller-registry";

describe("seller policy registry", () => {
  beforeEach(() => {
    clearSellerRegistryForTests();
  });

  it("registers a valid policy and makes it retrievable by sellerAgentId", () => {
    const result = registerSellerPolicy(sampleSellerPolicy);

    expect(result.ok).toBe(true);
    expect(getSellerPolicy(sampleSellerPolicy.sellerAgentId)).toEqual(sampleSellerPolicy);
  });

  it("rejects an invalid policy and does not register it", () => {
    const result = registerSellerPolicy({ ...sampleSellerPolicy, minimumPrice: -1 });

    expect(result.ok).toBe(false);
    expect(getSellerPolicy(sampleSellerPolicy.sellerAgentId)).toBeUndefined();
  });

  it("exposes only price-free public terms via discovery", () => {
    registerSellerPolicy(sampleSellerPolicy);
    const sellers = listPublicSellers();
    const serialized = JSON.stringify(sellers);

    expect(sellers).toEqual([
      {
        sellerAgentId: sampleSellerPolicy.sellerAgentId,
        service: sampleSellerPolicy.service,
        currency: sampleSellerPolicy.currency,
        standardDeliveryDays: sampleSellerPolicy.standardDeliveryDays,
        maxRounds: sampleSellerPolicy.maxRounds,
      },
    ]);
    expect(serialized).not.toContain("minimumPrice");
    expect(serialized).not.toContain("preferredPrice");
  });
});
