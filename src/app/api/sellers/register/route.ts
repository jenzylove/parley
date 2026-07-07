import { versionedError } from "@/api/negotiate-service";
import { registerSellerPolicy } from "@/api/seller-registry";
import type { RegisterSellerRequest } from "@/api/types";
import { PROTOCOL_VERSION } from "@/api/protocol-version";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const policy = (await request.json()) as RegisterSellerRequest;
    const validation = registerSellerPolicy(policy);

    if (!validation.ok) {
      return NextResponse.json(versionedError(validation.errors.join("; ")), { status: 400 });
    }

    return NextResponse.json({ protocolVersion: PROTOCOL_VERSION, sellerAgentId: policy.sellerAgentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid seller registration request";

    return NextResponse.json(versionedError(message), { status: 400 });
  }
}
