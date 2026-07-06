import type { Currency } from "../negotiation/types";

export type MarketRange = {
  low: number;
  high: number;
};

export type MarketIntelligence = {
  service: string;
  currency: Currency;
  marketAverage: number;
  marketRange: MarketRange;
  recommendedOffer: number;
  savingsAfterNegotiation: number;
  savingsPercent: number;
  dataSource: "demo";
};
