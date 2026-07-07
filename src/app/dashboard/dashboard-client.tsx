"use client";

import { useEffect, useState, useCallback } from "react";

type DashboardSummary = {
  stats: {
    negotiationsToday: number;
    totalNegotiations: number;
    revenue: number;
    dealsSaved: number;
    averageDiscount: number;
    successRate: number;
  };
  recentNegotiations: Array<{
    negotiationId: string;
    sellerAgentId: string;
    buyerAgentId: string;
    service: string;
    state: string;
    price: number | null;
    currency: string;
    settlementStatus: string | null;
    createdAt: string;
  }>;
  liveOrderActivity: Array<{
    negotiationId: string;
    service: string;
    status: string;
    note: string;
    at: string;
  }>;
};

const statCards: Array<{ key: keyof DashboardSummary["stats"]; label: string; format: (value: number) => string }> = [
  { key: "negotiationsToday", label: "Negotiations today", format: (v) => String(v) },
  { key: "revenue", label: "Revenue settled", format: (v) => `${v.toFixed(2)} USDC` },
  { key: "dealsSaved", label: "Deals saved", format: (v) => `${v.toFixed(2)} USDC` },
  { key: "averageDiscount", label: "Average discount", format: (v) => `${v}%` },
  { key: "successRate", label: "Success rate", format: (v) => `${v}%` },
];

const statusDotClass: Record<string, string> = {
  POSTED: "statusDot statusDot--created",
  NEGOTIATING: "statusDot statusDot--created",
  LOCKED: "statusDot statusDot--locked",
  DELIVERING: "statusDot statusDot--settling",
  DELIVERED: "statusDot statusDot--settling",
  SETTLING: "statusDot statusDot--settling",
  SETTLED: "statusDot statusDot--settled",
  FAILED: "statusDot statusDot--failed",
};

function humanizeAgentId(id: string): string {
  const looksLikeSlug = /^[a-z0-9]+(-[a-z0-9]+)+$/.test(id);
  if (!looksLikeSlug) return id;
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function relativeTime(iso: string): string {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const seconds = Math.round(deltaMs / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function DashboardClient() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/dashboard/summary", { cache: "no-store" });
    const body = await response.json();
    setData(body);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  async function seedSampleNegotiation() {
    setSeeding(true);
    try {
      await fetch("/api/negotiate/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: "balanced" }),
      });
      await load();
    } finally {
      setSeeding(false);
    }
  }

  if (!data) {
    return <p className="dashboardLoading">Loading…</p>;
  }

  const isEmpty = data.stats.totalNegotiations === 0;

  return (
    <div className="dashboard">
      <div className="statCardGrid">
        {statCards.map((card) => (
          <div key={card.key} className="statCard">
            <span>{card.label}</span>
            <strong>{card.format(data.stats[card.key])}</strong>
          </div>
        ))}
      </div>

      {isEmpty ? (
        <div className="dashboardEmpty">
          <p>No negotiations yet. Once your agent receives its first order, it&apos;ll show up here in real time.</p>
          <button type="button" className="wizardBtnPrimary" onClick={seedSampleNegotiation} disabled={seeding}>
            {seeding ? "Running…" : "Run a sample negotiation"}
          </button>
          <p className="dashboardListMeta">This runs one real negotiation through the demo scenario so you can see the dashboard populated.</p>
        </div>
      ) : (
        <div className="dashboardColumns">
          <section className="dashboardPanel">
            <h2>Recent negotiations</h2>
            <ul className="dashboardList">
              {data.recentNegotiations.map((entry) => (
                <li key={entry.negotiationId} className="dashboardListItem">
                  <div>
                    <strong>{entry.service}</strong>
                    <span className="dashboardListMeta">
                      {humanizeAgentId(entry.buyerAgentId)} &rarr; {humanizeAgentId(entry.sellerAgentId)}
                    </span>
                  </div>
                  <div className="dashboardListRight">
                    <span className={`badge badge--${entry.state === "agreement" ? "agreement" : entry.state === "no_deal" ? "nodeal" : "counter"}`}>
                      {entry.state.replace("_", " ")}
                    </span>
                    {entry.price !== null ? (
                      <strong>
                        {entry.price} {entry.currency}
                      </strong>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="dashboardPanel">
            <h2>Live order activity</h2>
            <ul className="dashboardList">
              {data.liveOrderActivity.map((event, index) => (
                <li key={`${event.negotiationId}-${index}`} className="dashboardListItem">
                  <div>
                    <strong>
                      <span className={statusDotClass[event.status] ?? "statusDot"} aria-hidden />
                      {event.status}
                    </strong>
                    <span className="dashboardListMeta">{event.note}</span>
                  </div>
                  <span className="dashboardListMeta" title={new Date(event.at).toLocaleString()}>
                    {relativeTime(event.at)}
                  </span>
                </li>
              ))}
              {data.liveOrderActivity.length === 0 ? <p className="dashboardListMeta">No settlement activity yet.</p> : null}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
