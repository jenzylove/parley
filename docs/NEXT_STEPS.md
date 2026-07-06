# Next Steps

## Recommended Batch 8

Make the API demo interactive while preserving protocol visibility.

- Add scenario selector: agreement, no-deal, max-rounds.
- Add step-by-step playback from API history.
- Add copy buttons for protocol JSON.
- Add a visible `protocolVersion` badge.
- Keep AI reasoning visually separated from protocol decisions.
- Add scenario controls for recurring-client and rush-delivery policy effects.
- Add an A2A transcript panel showing each agent's API call and response.

## Later

- Replace in-memory storage with SQLite.
- Add authentication or signed agent messages (agreements are not currently signed by either party's CAP identity).
- Run the provider side as its own long-lived process listening on `connectWebSocket()` for `NegotiationCreated` events, so external CAP agents (not just Parley's own demo agents) can hire Parley for real. Today `CROOSettlementAdapter` drives both sides synchronously from one process, which proves the on-chain settlement path but does not yet demonstrate third-party A2A composability.
- Add OpenAI provider behind the existing `AIProvider` interface if needed.
