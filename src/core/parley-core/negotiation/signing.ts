import { createPublicKey, generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify, type KeyObject } from "node:crypto";
import type { ProtocolMessage } from "./types";

/**
 * Parley-native agent signing. CAP's SDK never exposes the agent AA wallet's
 * private key to us — CROO's backend holds it via a delegated session key
 * (their own docs: withdrawals need "the owner's signature, which the
 * platform does not hold", implying normal order-flow txs are signed
 * server-side, not by us). So "sign with the CAP wallet" isn't something a
 * caller of this SDK can actually do.
 *
 * Instead, each Parley agent identity holds its own Ed25519 keypair, used
 * only to sign the negotiation-layer protocol messages (Offer, CounterOffer,
 * Accept, Agreement, NoDeal). This is what makes "machine-verifiable
 * agreement" literally true: a message claiming to be from
 * "seller-agent-copywriter" is only valid if it verifies against that
 * agent's known public key — nobody else can forge it.
 */
export type AgentKeyPair = {
  publicKey: string;
  privateKey: KeyObject;
};

export function generateAgentKeyPair(): AgentKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    privateKey,
  };
}

function importPublicKey(publicKeyBase64: string): KeyObject {
  return createPublicKey({
    key: Buffer.from(publicKeyBase64, "base64"),
    format: "der",
    type: "spki",
  });
}

/** Recursively sorts object keys so the same message always serializes identically, regardless of construction or JSON round-trip order. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => [key, canonicalize(val)] as const);

    return Object.fromEntries(sortedEntries);
  }

  return value;
}

function signingPayload(message: Omit<ProtocolMessage, "signature">): Buffer {
  const canonical = canonicalize({
    id: message.id,
    sender: message.sender,
    receiver: message.receiver,
    timestamp: message.timestamp,
    messageType: message.messageType,
    payload: message.payload,
  });

  return Buffer.from(JSON.stringify(canonical), "utf8");
}

export function signMessage<T extends ProtocolMessage>(message: Omit<T, "signature">, privateKey: KeyObject): T {
  const signature = cryptoSign(null, signingPayload(message), privateKey).toString("base64");

  return { ...message, signature } as T;
}

export function verifyMessageSignature(message: ProtocolMessage, publicKeyBase64: string): boolean {
  if (!message.signature) return false;

  try {
    const publicKey = importPublicKey(publicKeyBase64);
    const { signature, ...unsigned } = message;

    return cryptoVerify(null, signingPayload(unsigned), publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

/**
 * Generic canonical-JSON sign/verify for values that aren't a full
 * ProtocolMessage envelope — used for Parley's own platform attestation on
 * Agreement payloads (see AgreementPayload.platformAttestation).
 */
export function signPayload(payload: unknown, privateKey: KeyObject): string {
  return cryptoSign(null, Buffer.from(JSON.stringify(canonicalize(payload)), "utf8"), privateKey).toString("base64");
}

export function verifyPayload(payload: unknown, signature: string, publicKeyBase64: string): boolean {
  try {
    const publicKey = importPublicKey(publicKeyBase64);
    const data = Buffer.from(JSON.stringify(canonicalize(payload)), "utf8");

    return cryptoVerify(null, data, publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
