import { getPendingForSeller } from "@/api/negotiate-service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return NextResponse.json(getPendingForSeller(id));
}
