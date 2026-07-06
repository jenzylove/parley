import { startNegotiation, versionedError } from "@/api/negotiate-service";
import type { StartNegotiationRequest } from "@/api/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as StartNegotiationRequest;

    return NextResponse.json(await startNegotiation(payload));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid negotiation start request";

    return NextResponse.json(versionedError(message), { status: 400 });
  }
}
