import type { AgreementMessage, SellerPolicy, ServiceRequest } from "../negotiation/types";
import type { MarketIntelligence } from "./types";

type DemoMarketRecord = {
  service: string;
  average: number;
  low: number;
  high: number;
};

const demoMarketData: DemoMarketRecord[] = [
  {
    service: "Launch landing page copy",
    average: 72,
    low: 52,
    high: 96,
  },
  {
    service: "Landing page copy",
    average: 68,
    low: 48,
    high: 92,
  },
];

function marketRecordFor(service: string): DemoMarketRecord {
  return demoMarketData.find((record) => record.service.toLowerCase() === service.toLowerCase()) ?? {
    service,
    average: 70,
    low: 50,
    high: 95,
  };
}

export function recommendedOpeningOffer(request: ServiceRequest, policy: SellerPolicy): number {
  const record = marketRecordFor(request.service);
  const bundleAdjustment = request.requestedItems.length > 1 ? policy.bundleDiscount / 2 : 0;
  const recurringAdjustment = request.recurringClient ? policy.recurringClientDiscount : 0;
  const rushAdjustment = request.desiredDeliveryDays < policy.standardDeliveryDays ? policy.rushFee : 0;
  const rawRecommendation = Math.round(record.average - bundleAdjustment - recurringAdjustment + rushAdjustment);

  return Math.min(request.maxPrice, Math.max(request.targetPrice, rawRecommendation));
}

export function createMarketIntelligence(
  request: ServiceRequest,
  policy: SellerPolicy,
  agreement?: AgreementMessage,
): MarketIntelligence {
  const record = marketRecordFor(request.service);
  const negotiatedPrice = agreement?.payload.finalOffer.price ?? request.targetPrice;
  const savingsAfterNegotiation = Math.max(0, record.average - negotiatedPrice);

  return {
    service: request.service,
    currency: request.currency,
    marketAverage: record.average,
    marketRange: {
      low: record.low,
      high: record.high,
    },
    recommendedOffer: recommendedOpeningOffer(request, policy),
    savingsAfterNegotiation,
    savingsPercent: Math.round((savingsAfterNegotiation / record.average) * 100),
    dataSource: "demo",
  };
}
