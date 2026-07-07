import { listAllNegotiations } from "@/api/store";
import { PROTOCOL_VERSION } from "@/api/protocol-version";
import { demoSellerPolicy } from "@/app/api/negotiate/demo/scenarios";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Real aggregates over whatever this server process has actually handled —
 * there's no per-account auth/ownership model, so this is process-wide, not
 * scoped to "your" agents. Honest about it in the field names rather than
 * pretending to be a private multi-tenant view it isn't (yet).
 *
 * Excludes the homepage's public scenario-picker sandbox (demoSellerPolicy):
 * that identity isn't yours no matter which seller you registered, so
 * counting it here would make "your negotiation activity" show numbers with
 * no connection to your own policy.
 */
export async function GET() {
  const all = listAllNegotiations().filter((entry) => entry.session.sellerAgentId !== demoSellerPolicy.sellerAgentId);

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const negotiationsToday = all.filter((entry) => new Date(entry.session.createdAt).getTime() >= oneDayAgo).length;

  const resolved = all.filter((entry) => entry.result.agreement || entry.result.noDeal);
  const agreed = all.filter((entry) => entry.result.agreement);

  const revenue = agreed.reduce((sum, entry) => sum + (entry.result.agreement?.payload.finalOffer.price ?? 0), 0);
  const dealsSaved = agreed.reduce((sum, entry) => sum + (entry.result.agreement?.payload.savings ?? 0), 0);

  const discountPercents = agreed
    .map((entry) => entry.market?.savingsPercent)
    .filter((value): value is number => typeof value === "number");
  const averageDiscount =
    discountPercents.length > 0 ? Math.round(discountPercents.reduce((sum, value) => sum + value, 0) / discountPercents.length) : 0;

  const successRate = resolved.length > 0 ? Math.round((agreed.length / resolved.length) * 100) : 0;

  const recentNegotiations = all.slice(0, 12).map((entry) => ({
    negotiationId: entry.session.negotiationId,
    sellerAgentId: entry.session.sellerAgentId,
    buyerAgentId: entry.session.buyerAgentId,
    service: entry.request.service,
    state: entry.session.currentState,
    price: entry.result.agreement?.payload.finalOffer.price ?? null,
    currency: entry.request.currency,
    settlementStatus: entry.commerce?.order.status ?? null,
    createdAt: entry.session.createdAt,
  }));

  const liveOrderActivity = all
    .flatMap((entry) =>
      (entry.commerce?.order.lifecycle ?? []).map((event) => ({
        negotiationId: entry.session.negotiationId,
        service: entry.request.service,
        status: event.status,
        note: event.note,
        at: event.at,
      })),
    )
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 15);

  return NextResponse.json({
    protocolVersion: PROTOCOL_VERSION,
    stats: {
      negotiationsToday,
      totalNegotiations: all.length,
      revenue,
      dealsSaved,
      averageDiscount,
      successRate,
    },
    recentNegotiations,
    liveOrderActivity,
  });
}
