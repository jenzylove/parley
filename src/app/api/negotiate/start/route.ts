import { startNegotiation, versionedError } from "@/api/negotiate-service";
import type { StartNegotiationRequest } from "@/api/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as StartNegotiationRequest;
    const response = await startNegotiation(payload);
    const status = "error" in response ? 400 : 200;

    return NextResponse.json(response, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid negotiation start request";

    return NextResponse.json(versionedError(message), { status: 400 });
  }
}
