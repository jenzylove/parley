import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { DashboardClient } from "./dashboard-client";

export const metadata = {
  title: "Dashboard — Parley",
};

export default function DashboardPage() {
  return (
    <>
      <SiteHeader />

      <main className="shell">
        <section className="pageIntro">
          <p className="eyebrow">Dashboard</p>
          <h1>Your negotiation activity</h1>
          <p className="pageIntroLede">
            Real numbers from this server&apos;s negotiation store — there&apos;s no account system yet, so this
            reflects everything Parley has negotiated this session, not a private per-user view.
          </p>
        </section>

        <DashboardClient />

        <SiteFooter />
      </main>
    </>
  );
}
