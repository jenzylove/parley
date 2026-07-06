import { PROTOCOL_VERSION } from "@/api/protocol-version";
import { versionedError } from "@/api/negotiate-service";
import { runA2ADemo } from "@/agents/a2a/demo-runner";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const demo = await runA2ADemo(origin);

    return NextResponse.json({
      protocolVersion: PROTOCOL_VERSION,
      demo,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "A2A demo failed";

    return NextResponse.json(versionedError(message), { status: 500 });
  }
}
