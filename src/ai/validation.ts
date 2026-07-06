import type { NegotiationExplanation } from "./types";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);

const requireString = (value: unknown, key: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`AI explanation field ${key} must be a non-empty string`);
  }

  return value;
};

export function validateNegotiationExplanation(value: unknown): NegotiationExplanation {
  if (!value || typeof value !== "object") {
    throw new Error("AI explanation must be an object");
  }

  const candidate = value as Partial<Record<keyof NegotiationExplanation, unknown>>;
  const summary = requireString(candidate.summary, "summary");
  const rationale = requireString(candidate.rationale, "rationale");
  const buyerPerspective = requireString(candidate.buyerPerspective, "buyerPerspective");
  const sellerPerspective = requireString(candidate.sellerPerspective, "sellerPerspective");

  if (!isStringArray(candidate.tradeoffs)) {
    throw new Error("AI explanation field tradeoffs must be a non-empty string array");
  }

  const tradeoffs = candidate.tradeoffs;

  return {
    summary,
    rationale,
    tradeoffs,
    buyerPerspective,
    sellerPerspective,
  };
}

export function parseExplanationJson(text: string): NegotiationExplanation {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;

  return validateNegotiationExplanation(JSON.parse(jsonText));
}
