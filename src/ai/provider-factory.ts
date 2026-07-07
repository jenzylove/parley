import { AnthropicProvider } from "./providers/anthropic-provider";
import { LocalExplanationProvider } from "./providers/local-provider";
import type { AIProvider, ExplanationInput, NegotiationExplanation } from "./types";

/**
 * AI explanations are explicitly non-critical — the architecture's own rule
 * is "AI does not influence pricing decisions." A flaky external API call
 * shouldn't be able to sink an otherwise well-formed negotiation response
 * either, so any provider failure falls back to the deterministic local
 * explanation instead of throwing.
 */
function withFallback(provider: AIProvider, fallback: AIProvider): AIProvider {
  const wrap = (method: keyof AIProvider) => async (input: ExplanationInput): Promise<NegotiationExplanation> => {
    try {
      return await provider[method](input);
    } catch {
      return fallback[method](input);
    }
  };

  return {
    explainCounterOffer: wrap("explainCounterOffer"),
    explainAgreement: wrap("explainAgreement"),
    summarizeNegotiation: wrap("summarizeNegotiation"),
  };
}

export function createAIProvider(): AIProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const local = new LocalExplanationProvider();

  if (apiKey && process.env.NODE_ENV !== "test") {
    return withFallback(new AnthropicProvider(apiKey), local);
  }

  return local;
}
