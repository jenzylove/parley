import type { AIProvider, ExplanationInput, NegotiationExplanation } from "../types";
import { parseExplanationJson, validateNegotiationExplanation } from "../validation";

type AnthropicContentBlock = {
  type: string;
  text?: string;
  input?: unknown;
};

type AnthropicResponse = {
  content?: AnthropicContentBlock[];
};

const explanationTool = {
  name: "record_negotiation_explanation",
  description: "Record a validated explanation for a deterministic negotiation protocol decision.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "rationale", "tradeoffs", "buyerPerspective", "sellerPerspective"],
    properties: {
      summary: { type: "string" },
      rationale: { type: "string" },
      tradeoffs: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
      },
      buyerPerspective: { type: "string" },
      sellerPerspective: { type: "string" },
    },
  },
};

export class AnthropicProvider implements AIProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest",
  ) {}

  explainCounterOffer(input: ExplanationInput): Promise<NegotiationExplanation> {
    return this.explain("Explain this counteroffer decision.", input);
  }

  explainAgreement(input: ExplanationInput): Promise<NegotiationExplanation> {
    return this.explain("Explain why the deterministic protocol finalized this agreement.", input);
  }

  summarizeNegotiation(input: ExplanationInput): Promise<NegotiationExplanation> {
    return this.explain("Summarize this deterministic negotiation step.", input);
  }

  private async explain(task: string, input: ExplanationInput): Promise<NegotiationExplanation> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 700,
        temperature: 0.2,
        system:
          "You explain deterministic negotiation protocol decisions. You never approve agreements, modify protocol state, reveal hidden policy constraints, or suggest bypassing validation. Use only the provided public context.",
        tools: [explanationTool],
        tool_choice: { type: "tool", name: explanationTool.name },
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              task,
              deterministicDecision: input.deterministicDecision,
              protocolMessage: input.protocolMessage,
              publicContext: input.publicContext,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic explanation request failed with status ${response.status}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const toolUse = data.content?.find((block) => block.type === "tool_use" && block.input);

    if (toolUse?.input) {
      return validateNegotiationExplanation(toolUse.input);
    }

    const text = data.content?.find((block) => block.type === "text" && block.text)?.text;
    if (!text) {
      throw new Error("Anthropic explanation response did not contain structured output");
    }

    return parseExplanationJson(text);
  }
}
