import { generateAgentKeyPair } from "@/core/parley-core";
import type { SellerPolicy } from "@/core/parley-core";
import { registerSellerPolicy } from "@/api/seller-registry";
import { versionedError } from "@/api/negotiate-service";
import { PROTOCOL_VERSION } from "@/api/protocol-version";
import { NextResponse } from "next/server";

export type OnboardingRequest = {
  sellerAgentId: string;
  service: string;
  minimumPrice: number;
  preferredPrice: number;
  standardDeliveryDays: number;
  rushFee: number;
  bundleDiscount: number;
  recurringClientDiscount: number;
  maximumWorkload: number;
  maxRounds: number;
};

/**
 * Onboards a seller identity for real: generates its Ed25519 signing
 * keypair server-side (there's no per-account custody model yet — this is
 * the same "Parley holds the key for you" simplification sample-seller.ts
 * and the demo scenarios already use) and registers a real SellerPolicy via
 * the same registry every negotiation checks against. Nothing about this is
 * simulated; a negotiation started against this sellerAgentId right after
 * onboarding is a genuine one.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OnboardingRequest;

    if (!body.sellerAgentId || !body.sellerAgentId.trim()) {
      return NextResponse.json(versionedError("sellerAgentId is required"), { status: 400 });
    }

    const { publicKey } = generateAgentKeyPair();

    const policy: SellerPolicy = {
      sellerAgentId: body.sellerAgentId.trim(),
      publicKey,
      service: body.service?.trim() || "Untitled service",
      currency: "USDC",
      minimumPrice: body.minimumPrice,
      preferredPrice: body.preferredPrice,
      standardDeliveryDays: body.standardDeliveryDays,
      rushFee: body.rushFee,
      bundleDiscount: body.bundleDiscount,
      recurringClientDiscount: body.recurringClientDiscount,
      maximumWorkload: body.maximumWorkload,
      currentWorkload: 0,
      preferredPaymentSchedule: "upfront",
      maxRounds: body.maxRounds,
    };

    const validation = registerSellerPolicy(policy);

    if (!validation.ok) {
      return NextResponse.json(versionedError(validation.errors.join("; ")), { status: 400 });
    }

    return NextResponse.json({ protocolVersion: PROTOCOL_VERSION, sellerAgentId: policy.sellerAgentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid onboarding request";

    return NextResponse.json(versionedError(message), { status: 400 });
  }
}
