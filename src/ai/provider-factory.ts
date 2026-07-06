import { AnthropicProvider } from "./providers/anthropic-provider";
import { LocalExplanationProvider } from "./providers/local-provider";
import type { AIProvider } from "./types";

export function createAIProvider(): AIProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey && process.env.NODE_ENV !== "test") {
    return new AnthropicProvider(apiKey);
  }

  return new LocalExplanationProvider();
}
