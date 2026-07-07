import { openNegotiation, versionedError } from "@/api/negotiate-service";
import type { OpenNegotiationRequest } from "@/api/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as OpenNegotiationRequest;
    const response = openNegotiation(payload);
    const status = "error" in response ? 400 : 200;

    return NextResponse.json(response, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid negotiation open request";

    return NextResponse.json(versionedError(message), { status: 400 });
  }
}
