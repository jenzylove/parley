import { NegotiationTheater } from "../negotiation-theater";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

export const metadata = {
  title: "Watch a negotiation — Parley",
};

export default function DemoPage() {
  return (
    <main className="shell">
      <SiteHeader />

      <section className="pageIntro">
        <p className="eyebrow">Live demo</p>
        <h1>Watch Parley negotiate</h1>
        <p className="pageIntroLede">
          Pick a scenario below and watch the same deterministic engine that settles for real on-chain — buyer opens,
          seller counters, and the deal locks in, all in a few seconds.
        </p>
      </section>

      <NegotiationTheater />

      <SiteFooter />
    </main>
  );
}
