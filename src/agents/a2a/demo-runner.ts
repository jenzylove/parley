import { toPublicSellerTerms } from "@/core/parley-core";
import { sampleBuyerRequest } from "../buyer/sample-buyer";
import { sampleSellerPolicy } from "../seller/sample-seller";
import { BuyerAgent } from "./buyer-agent";
import { HttpParleyApiClient } from "./parley-api-client";
import { ObserverAgent } from "./observer-agent";
import { SellerAgent } from "./seller-agent";
import type { A2ADemoResult } from "./types";

export async function runA2ADemo(baseUrl: string): Promise<A2ADemoResult> {
  const parley = new HttpParleyApiClient(baseUrl);
  const buyer = new BuyerAgent(sampleBuyerRequest.buyerAgentId, sampleBuyerRequest, parley);
  const seller = new SellerAgent(sampleSellerPolicy.sellerAgentId, sampleSellerPolicy, parley);
  const observer = new ObserverAgent("observer-agent-demo", parley);

  await seller.register();
  const negotiation = await buyer.negotiateWith(seller.identity.agentId);
  const negotiationId = negotiation.result.session.negotiationId;
  const [session, history, observerSummary] = await Promise.all([
    parley.getSession(negotiationId),
    parley.getHistory(negotiationId),
    observer.summarize(negotiationId),
  ]);

  return {
    buyerAgent: buyer.identity,
    sellerAgent: seller.identity,
    observerAgent: observer.identity,
    request: buyer.getRequest(),
    sellerPublicTerms: toPublicSellerTerms(seller.getPolicy()),
    negotiation,
    session,
    history,
    observerSummary,
  };
}
