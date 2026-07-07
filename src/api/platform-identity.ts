import { generateAgentKeyPair, type AgentKeyPair } from "@/core/parley-core/negotiation/signing";
import { getGlobalSingleton } from "./global-singleton";

/**
 * Parley's own negotiation-service identity. Used to attest Agreement
 * payloads (AgreementPayload.platformAttestation) — the registry is the only
 * party that can honestly compute policyExplanation from a seller's
 * registered (private) policy, so it signs that computation itself rather
 * than asking the seller to sign something it didn't independently produce.
 *
 * Generated once per server process and anchored on globalThis (see
 * global-singleton.ts) so it survives Next.js dev's per-route module
 * isolation — the same key must verify across every route handler.
 */
export function getPlatformKeyPair(): AgentKeyPair {
  return getGlobalSingleton("platformKeyPair", () => generateAgentKeyPair());
}
