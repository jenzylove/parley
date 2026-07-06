import { getNegotiationSession } from "@/api/negotiate-service";
import { NextResponse } from "next/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const response = getNegotiationSession(id);
  const status = "error" in response ? 404 : 200;

  return NextResponse.json(response, { status });
}
