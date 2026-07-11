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
 * the same registry every negotiation checks against. No CAP credentials
 * are collected or verified here — this step only configures the policy.
 * Going live against real CAP happens by running the standalone provider
 * listener locally with your own CROO credentials (see /start's success
 * screen), which is what actually proves ownership: only a real, working
 * key can connect to CAP at all.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OnboardingRequest;

    if (!body.sellerAgentId || !body.sellerAgentId.trim()) {
      return NextResponse.json(versionedError("sellerAgentId is required"), { status: 400 });
    }

    // The wizard always sends numbers, but this is a public POST endpoint —
    // guard against a raw caller sending strings, NaN, or negatives before the
    // values reach the policy (validateSellerPolicy is a second backstop).
    const numericFields: Array<keyof OnboardingRequest> = [
      "minimumPrice",
      "preferredPrice",
      "standardDeliveryDays",
      "rushFee",
      "bundleDiscount",
      "recurringClientDiscount",
      "maximumWorkload",
      "maxRounds",
    ];
    for (const field of numericFields) {
      const value = body[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return NextResponse.json(versionedError(`"${field}" must be a number greater than or equal to 0.`), { status: 400 });
      }
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
