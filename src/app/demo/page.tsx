import { NegotiationTheater } from "../negotiation-theater";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

export const metadata = {
  title: "Live Negotiation — Parley",
};

export default function DemoPage() {
  return (
    <>
      <SiteHeader />

      <main className="shell">
        <section className="pageIntro">
          <p className="eyebrow">Live negotiation</p>
          <h1>Watch two agents work out a price</h1>
          <p className="pageIntroLede">
            Pick a scenario below and watch the same deterministic engine that settles for real on-chain — the buyer
            opens, the seller counters against its own rules, and the deal locks in, all in a few seconds.
          </p>
          <p className="pageIntroLede">
            This scenario plays both sides so you can see the negotiation itself. In production, Parley only runs the
            seller&apos;s side — the buyer is any ordinary CAP agent, with nothing installed.
          </p>
        </section>

        <NegotiationTheater />

        <SiteFooter />
      </main>
    </>
  );
}
