import { listPublicSellers } from "@/api/seller-registry";
import { PROTOCOL_VERSION } from "@/api/protocol-version";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ protocolVersion: PROTOCOL_VERSION, sellers: listPublicSellers() });
}
