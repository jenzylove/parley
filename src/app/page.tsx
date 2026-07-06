import { createPublicSellerTerms } from "@/ai/explanation-layer";
import type { A2ADemoResponse } from "@/agents/a2a/types";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>{title}</h2>
      </div>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}

async function runDemoAgents(): Promise<A2ADemoResponse> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const response = await fetch(`${protocol}://${host}/api/a2a/demo`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to run A2A demo through protocol API");
  }

  return (await response.json()) as A2ADemoResponse;
}

export default async function Home() {
  const a2aResponse = await runDemoAgents();
  const demo = a2aResponse.demo;
  const apiResponse = demo.negotiation;
  const result = apiResponse.result;
  const explainedMessages = apiResponse.explanations;
  const agreement = result.agreement?.payload;
  const noDeal = result.noDeal?.payload;
  const session = result.session;
  const order = apiResponse.commerce.order;
  const sellerPolicy = createPublicSellerTerms(demo.sellerPolicy);
  const market = apiResponse.market;

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">CAP-Negotiate MVP</p>
          <h1>Parley turns agent pricing into a visible protocol.</h1>
          <p className="lede">
            A buyer agent requests a service, a seller policy constrains the negotiation, and the deterministic engine
            produces locked terms that can flow into the CROO commerce lifecycle.
          </p>
        </div>
        <div className="statusCard">
          <span>Status</span>
          <strong>{order.status}</strong>
          <p>Negotiation {session.currentState.replace("_", " ").toUpperCase()}</p>
          <p>Round {session.currentRound} of {session.maxRounds}</p>
          {agreement ? <p>{agreement.savings} USDC saved against the seller preferred price.</p> : null}
          {agreement ? <p>{market.savingsAfterNegotiation} USDC saved versus market average.</p> : null}
          {noDeal ? <p>{noDeal.reason}</p> : null}
        </div>
      </section>

      <section className="flowBand">
        <div>
          <p className="miniLabel">Seller Policy</p>
          <strong>{demo.sellerPolicy.minimumPrice}-{demo.sellerPolicy.preferredPrice} USDC</strong>
        </div>
        <div>
          <p className="miniLabel">Negotiation</p>
          <strong>{session.currentState.replace("_", " ")}</strong>
        </div>
        <div>
          <p className="miniLabel">Market Comparison</p>
          <strong>{market.marketAverage} USDC avg</strong>
        </div>
        <div>
          <p className="miniLabel">Locked Terms</p>
          <strong>{order.lockedTerms ? `${order.lockedTerms.price} USDC` : "none"}</strong>
        </div>
      </section>

      {agreement ? (
        <section className="agreement">
          <div>
            <p className="eyebrow">Generated Agreement</p>
            <h2>{agreement.finalOffer.price} USDC</h2>
            <p>{agreement.policyExplanation.acceptedBecause}</p>
          </div>
          <dl>
            <div>
              <dt>Rounds</dt>
              <dd>{agreement.roundsUsed}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{agreement.finalOffer.deliveryDays} days</dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>{new Date(agreement.expiresAt).toLocaleTimeString()}</dd>
            </div>
          </dl>
          <div className="wideList">
            <p className="miniLabel">Policy Constraints That Mattered</p>
            <ul>
              {agreement.policyExplanation.constraintsApplied.map((constraint) => (
                <li key={constraint}>{constraint}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {noDeal ? (
        <section className="agreement">
          <div>
            <p className="eyebrow">No Deal</p>
            <h2>Terminated</h2>
            <p>{noDeal.reason}</p>
          </div>
          <dl>
            <div>
              <dt>Final Round</dt>
              <dd>{noDeal.finalRound}</dd>
            </div>
            <div>
              <dt>Max Rounds</dt>
              <dd>{session.maxRounds}</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>{session.currentState}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="grid">
        <JsonBlock title="Buyer Agent" value={{ agent: demo.buyerAgent, request: demo.request }} />
        <JsonBlock title="Seller Policy" value={sellerPolicy} />
        <JsonBlock title="Market Intelligence" value={market} />
      </section>

      <section className="agreement">
        <div>
          <p className="eyebrow">A2A Demonstration</p>
          <h2>{demo.observerSummary.finalState}</h2>
          <p>{demo.observerSummary.summary}</p>
        </div>
        <dl>
          <div>
            <dt>Buyer Agent</dt>
            <dd>{demo.buyerAgent.agentId}</dd>
          </div>
          <div>
            <dt>Seller Agent</dt>
            <dd>{demo.sellerAgent.agentId}</dd>
          </div>
          <div>
            <dt>Observer</dt>
            <dd>{demo.observerAgent.agentId}</dd>
          </div>
        </dl>
      </section>

      <section className="agreement">
        <div>
          <p className="eyebrow">Market Comparison</p>
          <h2>{market.savingsAfterNegotiation} USDC saved</h2>
          <p>
            Recommended offer was {market.recommendedOffer} {market.currency}. Market range is {market.marketRange.low}-{market.marketRange.high} {market.currency}.
          </p>
        </div>
        <dl>
          <div>
            <dt>Market Average</dt>
            <dd>{market.marketAverage} {market.currency}</dd>
          </div>
          <div>
            <dt>Final Price</dt>
            <dd>{agreement?.finalOffer.price ?? "none"} {market.currency}</dd>
          </div>
          <div>
            <dt>Savings</dt>
            <dd>{market.savingsPercent}%</dd>
          </div>
        </dl>
      </section>

      <section className="grid">
        <JsonBlock title="Negotiation" value={result} />
        <JsonBlock title="Locked Terms" value={order.lockedTerms ?? null} />
        <JsonBlock title="A2A API Response" value={a2aResponse} />
      </section>

      <section className="agreement">
        <div>
          <p className="eyebrow">CROO Commerce Lifecycle</p>
          <h2>{order.status}</h2>
          <p>
            Parley ends at locked terms. CROO begins at delivery proof and settlement through the adapter boundary.
          </p>
        </div>
        <dl>
          <div>
            <dt>Locked Terms</dt>
            <dd>{order.lockedTerms ? "Present" : "Missing"}</dd>
          </div>
          <div>
            <dt>Delivery Proof</dt>
            <dd>{order.deliveryProof?.proofType ?? "none"}</dd>
          </div>
          <div>
            <dt>Settlement</dt>
            <dd>{order.settlement?.status ?? "none"}</dd>
          </div>
        </dl>
      </section>

      <section className="timeline">
        <h2>Protocol Messages</h2>
        {explainedMessages.map((item, index) => (
          <article key={item.protocolMessage.id}>
            <span>{index + 1}</span>
            <div>
              <h3>{item.protocolMessage.messageType}</h3>
              <div className="decisionGrid">
                <section>
                  <p className="miniLabel">Protocol Decision</p>
                  <p>{item.deterministicDecision}</p>
                  <pre>{JSON.stringify(item.protocolMessage, null, 2)}</pre>
                </section>
                <section>
                  <p className="miniLabel">AI Reasoning</p>
                  <p>{item.aiExplanation.summary}</p>
                  <p>{item.aiExplanation.rationale}</p>
                  <ul>
                    {item.aiExplanation.tradeoffs.map((tradeoff) => (
                      <li key={tradeoff}>{tradeoff}</li>
                    ))}
                  </ul>
                  <pre>{JSON.stringify(item.aiExplanation, null, 2)}</pre>
                </section>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="timeline">
        <h2>Commerce Lifecycle</h2>
        {order.lifecycle.map((event, index) => (
          <article key={`${event.status}-${index}`}>
            <span>{index + 1}</span>
            <div>
              <h3>{event.status}</h3>
              <p>{event.note}</p>
              <pre>{JSON.stringify(event, null, 2)}</pre>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
