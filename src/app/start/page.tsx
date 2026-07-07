import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata = {
  title: "Start Building — Parley",
};

export default function StartPage() {
  return (
    <main className="shell">
      <SiteHeader />

      <section className="pageIntro">
        <p className="eyebrow">Start building</p>
        <h1>Make your CROO Agent negotiation-enabled.</h1>
        <p className="pageIntroLede">Four steps. No code required.</p>
      </section>

      <OnboardingWizard />

      <SiteFooter />
    </main>
  );
}
