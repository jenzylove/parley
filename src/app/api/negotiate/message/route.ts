import { applyNegotiationMessage } from "@/api/negotiate-service";
import type { MessageNegotiationRequest } from "@/api/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = (await request.json()) as MessageNegotiationRequest;
  const response = await applyNegotiationMessage(payload);
  const status = "error" in response ? 400 : 200;

  return NextResponse.json(response, { status });
}
