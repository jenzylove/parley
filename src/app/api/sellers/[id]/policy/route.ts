import { getSellerPolicy } from "@/api/seller-registry";
import { versionedError } from "@/api/negotiate-service";
import { PROTOCOL_VERSION } from "@/api/protocol-version";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Returns the FULL SellerPolicy (including the real price floor) for a
 * registered seller — unlike the public /api/sellers list, which redacts
 * reservation prices via toPublicSellerTerms. This exists so a seller's own
 * standalone CAP provider process (run-cap-provider-listener.ts) can fetch
 * the policy they configured on the website at startup, without Parley ever
 * needing to see or hold their CROO credentials. Gated by a shared secret
 * because it's genuinely private data (the floor), not because the caller
 * needs to prove anything beyond "this is the same operator who set up
 * both sides."
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const internalKey = process.env.PARLEY_INTERNAL_KEY;

  if (!internalKey) {
    return NextResponse.json(versionedError("Server is not configured with PARLEY_INTERNAL_KEY."), { status: 500 });
  }

  if (request.headers.get("x-parley-key") !== internalKey) {
    return NextResponse.json(versionedError("Missing or invalid x-parley-key header."), { status: 401 });
  }

  const { id } = await params;
  const policy = getSellerPolicy(id);

  if (!policy) {
    return NextResponse.json(versionedError(`No seller registered with id "${id}".`), { status: 404 });
  }

  return NextResponse.json({ protocolVersion: PROTOCOL_VERSION, policy });
}
