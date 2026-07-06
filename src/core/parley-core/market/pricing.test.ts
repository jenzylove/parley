import { describe, expect, it } from "vitest";
import { sampleBuyerRequest } from "../../../agents/buyer/sample-buyer";
import { sampleSellerPolicy } from "../../../agents/seller/sample-seller";
import { createMarketIntelligence, recommendedOpeningOffer, runNegotiation } from "../index";

describe("market intelligence", () => {
  it("creates deterministic market comparison from demo data", () => {
    const result = runNegotiation(sampleBuyerRequest, sampleSellerPolicy);
    const market = createMarketIntelligence(sampleBuyerRequest, sampleSellerPolicy, result.agreement);

    expect(market.marketAverage).toBe(72);
    expect(market.marketRange).toEqual({ low: 52, high: 96 });
    expect(market.recommendedOffer).toBeLessThanOrEqual(sampleBuyerRequest.maxPrice);
    expect(market.savingsAfterNegotiation).toBeGreaterThan(0);
    expect(market.dataSource).toBe("demo");
  });

  it("recommends an offer within buyer constraints", () => {
    const recommended = recommendedOpeningOffer(sampleBuyerRequest, sampleSellerPolicy);

    expect(recommended).toBeGreaterThanOrEqual(sampleBuyerRequest.targetPrice);
    expect(recommended).toBeLessThanOrEqual(sampleBuyerRequest.maxPrice);
  });
});
