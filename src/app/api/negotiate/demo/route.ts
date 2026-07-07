import { startNegotiation, versionedError } from "@/api/negotiate-service";
import { registerSellerPolicy } from "@/api/seller-registry";
import { MockSettlementAdapter } from "@/cap/mock-settlement-adapter";
import { NextResponse } from "next/server";
import { buildScenarioRequest, demoSellerPolicy } from "./scenarios";
import type { ScenarioKey } from "./scenario-labels";

const scenarioKeys: ScenarioKey[] = ["balanced", "bundle-recurring", "rush", "no-deal"];

/**
 * Always settles through MockSettlementAdapter, never the real CAP adapter.
 * This route exists so the homepage's interactive scenario picker is free
 * and instant regardless of whether CROO_* credentials are configured — the
 * one real on-chain settlement is captured separately as static proof.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { scenario?: string };
    const scenario = body.scenario as ScenarioKey;

    if (!scenarioKeys.includes(scenario)) {
      return NextResponse.json(versionedError(`Unknown scenario "${body.scenario}". Expected one of: ${scenarioKeys.join(", ")}`), {
        status: 400,
      });
    }

    registerSellerPolicy(demoSellerPolicy);

    const serviceRequest = buildScenarioRequest(scenario);
    const response = await startNegotiation(
      { request: serviceRequest, sellerAgentId: demoSellerPolicy.sellerAgentId },
      new MockSettlementAdapter(),
    );
    const status = "error" in response ? 400 : 200;

    return NextResponse.json(response, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid demo negotiation request";

    return NextResponse.json(versionedError(message), { status: 400 });
  }
}
