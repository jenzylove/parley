"use client";

import { useEffect, useMemo, useState } from "react";
import type { NegotiationResponse } from "@/api/types";
import type {
  AgreementPayload,
  CommerceLifecycleEvent,
  NoDealPayload,
  OfferPayload,
  ProtocolMessage,
} from "@/core/parley-core";
import { scenarioLabels, type ScenarioKey } from "./api/negotiate/demo/scenario-labels";

const scenarioOrder: ScenarioKey[] = ["balanced", "bundle-recurring", "rush", "no-deal"];

type Step =
  | { kind: "message"; key: string; message: ProtocolMessage }
  | { kind: "lifecycle"; key: string; event: CommerceLifecycleEvent };

const messageBadgeClass: Record<ProtocolMessage["messageType"], string> = {
  Offer: "badge badge--offer",
  CounterOffer: "badge badge--counter",
  Accept: "badge badge--accept",
  Reject: "badge badge--nodeal",
  Agreement: "badge badge--agreement",
  NoDeal: "badge badge--nodeal",
};

const agreementStages = ["Buyer", "Offer", "Counteroffer", "Buyer Response", "Agreement", "Locked Terms", "CAP Settlement", "Completed"] as const;
const noDealStages = ["Buyer", "Offer", "Counteroffer", "Buyer Response", "No Deal"] as const;

function narrativeStageFlags(revealed: Step[], buyerAgentId: string, isNoDeal: boolean): Record<string, boolean> {
  const messages = revealed.filter((s): s is Extract<Step, { kind: "message" }> => s.kind === "message").map((s) => s.message);
  const lifecycle = revealed.filter((s): s is Extract<Step, { kind: "lifecycle" }> => s.kind === "lifecycle").map((s) => s.event);

  const hasOpeningOffer = messages.some((m) => m.messageType === "Offer");
  const hasCounter = messages.some((m) => m.messageType === "CounterOffer");
  const hasBuyerCounter = messages.some((m) => m.messageType === "CounterOffer" && m.sender === buyerAgentId);
  const hasNoDeal = messages.some((m) => m.messageType === "NoDeal" || m.messageType === "Reject");

  if (isNoDeal) {
    return {
      Buyer: hasOpeningOffer,
      Offer: hasOpeningOffer,
      Counteroffer: hasCounter,
      "Buyer Response": hasBuyerCounter,
      "No Deal": hasNoDeal,
    };
  }

  return {
    Buyer: hasOpeningOffer,
    Offer: hasOpeningOffer,
    Counteroffer: hasCounter,
    "Buyer Response": hasBuyerCounter,
    Agreement: messages.some((m) => m.messageType === "Agreement"),
    "Locked Terms": lifecycle.some((e) => e.status === "LOCKED"),
    "CAP Settlement": lifecycle.some((e) => e.status === "SETTLING"),
    Completed: lifecycle.some((e) => e.status === "SETTLED"),
  };
}

function NarrativeStepper({ revealed, buyerAgentId, isNoDeal }: { revealed: Step[]; buyerAgentId: string; isNoDeal: boolean }) {
  const stages = isNoDeal ? noDealStages : agreementStages;
  const flags = narrativeStageFlags(revealed, buyerAgentId, isNoDeal);

  return (
    <ol className="narrativeStepper">
      {stages.map((stage) => (
        <li key={stage} className={flags[stage] ? "narrativeStep narrativeStep--reached" : "narrativeStep"}>
          <span className="narrativeStepDot" aria-hidden />
          <span>{stage}</span>
        </li>
      ))}
    </ol>
  );
}

function MessageStep({ message }: { message: ProtocolMessage }) {
  if (message.messageType === "Offer" || message.messageType === "CounterOffer") {
    const payload = message.payload as OfferPayload;
    return (
      <div className="stepBody">
        <p className="stepFrom">
          {message.sender} <span>&rarr;</span> {message.receiver}
        </p>
        <p className="stepHeadline">
          {payload.price} {payload.currency}
          <span className="stepMeta"> · round {payload.round} · {payload.deliveryDays}d delivery</span>
        </p>
      </div>
    );
  }

  if (message.messageType === "Accept") {
    return (
      <div className="stepBody">
        <p className="stepFrom">
          {message.sender} <span>&rarr;</span> {message.receiver}
        </p>
        <p className="stepHeadline">Accepted</p>
      </div>
    );
  }

  if (message.messageType === "Agreement") {
    const payload = message.payload as AgreementPayload;
    return (
      <div className="stepBody">
        <p className="stepFrom">Locked terms generated</p>
        <p className="stepHeadline">
          {payload.finalOffer.price} {payload.finalOffer.currency}
          <span className="stepMeta"> · {payload.roundsUsed} round{payload.roundsUsed === 1 ? "" : "s"} used</span>
        </p>
      </div>
    );
  }

  if (message.messageType === "NoDeal" || message.messageType === "Reject") {
    const payload = message.payload as NoDealPayload;
    return (
      <div className="stepBody">
        <p className="stepFrom">Negotiation terminated</p>
        <p className="stepHeadline">{payload.reason}</p>
      </div>
    );
  }

  return null;
}

function stepsFor(response: NegotiationResponse): Step[] {
  const messageSteps: Step[] = response.result.session.messageHistory.map((message) => ({
    kind: "message",
    key: message.id,
    message,
  }));

  const lifecycleSteps: Step[] = response.commerce.order.lifecycle.map((event, index) => ({
    kind: "lifecycle",
    key: `${event.status}-${index}`,
    event,
  }));

  return [...messageSteps, ...lifecycleSteps];
}

export function NegotiationTheater() {
  const [scenario, setScenario] = useState<ScenarioKey>("balanced");
  const [data, setData] = useState<NegotiationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealCount, setRevealCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRevealCount(0);

    fetch("/api/negotiate/demo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario }),
    })
      .then((response) => response.json())
      .then((body) => {
        if (cancelled) return;
        if ("error" in body) {
          setError(body.error);
          setData(null);
        } else {
          setData(body as NegotiationResponse);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to run scenario");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scenario]);

  const steps = useMemo(() => (data ? stepsFor(data) : []), [data]);

  useEffect(() => {
    if (!data || steps.length === 0) return;
    setRevealCount(0);
    const interval = setInterval(() => {
      setRevealCount((count) => {
        if (count >= steps.length) {
          clearInterval(interval);
          return count;
        }
        return count + 1;
      });
    }, 420);

    return () => clearInterval(interval);
  }, [data, steps.length]);

  const agreement = data?.result.agreement?.payload as AgreementPayload | undefined;
  const noDeal = data?.result.noDeal?.payload as NoDealPayload | undefined;
  const fullyRevealed = steps.length > 0 && revealCount >= steps.length;
  const order = data?.commerce.order;
  const revealedSteps = steps.slice(0, revealCount);

  return (
    <section className="theater">
      <div className="theaterHeader">
        <div>
          <p className="eyebrow">See it in action</p>
          <h2>Pick a scenario</h2>
        </div>
        <p className="theaterNote">Instant &amp; free — settles through a local mock adapter, not real CAP.</p>
      </div>

      <div className="scenarioPicker">
        {scenarioOrder.map((key) => (
          <button
            key={key}
            type="button"
            className={key === scenario ? "scenarioButton scenarioButton--active" : "scenarioButton"}
            onClick={() => setScenario(key)}
            disabled={loading}
          >
            <strong>{scenarioLabels[key].title}</strong>
            <span>{scenarioLabels[key].description}</span>
          </button>
        ))}
      </div>

      {error ? <p className="theaterError">{error}</p> : null}

      {data ? (
        <div className="theaterStage">
          <NarrativeStepper revealed={revealedSteps} buyerAgentId={data.result.session.buyerAgentId} isNoDeal={!!noDeal} />

          {fullyRevealed && agreement ? (
            <div className="outcomeCard outcomeCard--agreement">
              <p className="eyebrow">Agreement reached</p>
              <h3>
                {agreement.finalOffer.price} {agreement.finalOffer.currency}
              </h3>
              <p>{agreement.policyExplanation.acceptedBecause}</p>
              <ul className="chipList">
                {agreement.policyExplanation.constraintsApplied.map((constraint) => (
                  <li key={constraint} className="chip">
                    {constraint}
                  </li>
                ))}
              </ul>
              <p className="outcomeMeta">
                {agreement.roundsUsed} round{agreement.roundsUsed === 1 ? "" : "s"} used · settlement:{" "}
                {order?.settlement?.status ?? "pending"} ({order?.settlement?.adapter})
              </p>
            </div>
          ) : null}

          {fullyRevealed && noDeal ? (
            <div className="outcomeCard outcomeCard--nodeal">
              <p className="eyebrow">No deal</p>
              <h3>Negotiation terminated</h3>
              <p>{noDeal.reason}</p>
              <p className="outcomeMeta">Stopped after round {noDeal.finalRound}.</p>
            </div>
          ) : null}

          <details className="rawDetails">
            <summary>Developer view — protocol messages &amp; raw JSON</summary>
            <ol className="stepTimeline">
              {revealedSteps.map((step) =>
                step.kind === "message" ? (
                  <li key={step.key} className="stepEntry stepEntry--in">
                    <span className={messageBadgeClass[step.message.messageType]}>{step.message.messageType}</span>
                    <MessageStep message={step.message} />
                  </li>
                ) : (
                  <li key={step.key} className="stepEntry stepEntry--in stepEntry--lifecycle">
                    <span className="badge badge--lifecycle">{step.event.status}</span>
                    <div className="stepBody">
                      <p className="stepHeadline">{step.event.note}</p>
                    </div>
                  </li>
                ),
              )}
            </ol>

            <details className="rawDetails">
              <summary>Raw protocol JSON</summary>
              <pre>{JSON.stringify(data, null, 2)}</pre>
            </details>
          </details>
        </div>
      ) : null}
    </section>
  );
}
