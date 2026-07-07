"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type FormState = {
  sellerAgentId: string;
  service: string;
  standardDeliveryDays: number;
  minimumPrice: number;
  preferredPrice: number;
  rushFee: number;
  bundleDiscount: number;
  recurringClientDiscount: number;
  maxRounds: number;
  maximumWorkload: number;
};

const defaults: FormState = {
  sellerAgentId: "",
  service: "",
  standardDeliveryDays: 5,
  minimumPrice: 44,
  preferredPrice: 64,
  rushFee: 8,
  bundleDiscount: 10,
  recurringClientDiscount: 4,
  maxRounds: 3,
  maximumWorkload: 6,
};

const serviceOptions = [
  "SEO Audit",
  "Logo Design",
  "Smart Contract Review",
  "AI Research",
  "Translation",
  "Data Analysis",
];

const CUSTOM_SERVICE = "custom";

const stepLabels = ["Import agent", "Agent details", "Negotiation rules", "Review"];

function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <label className="wizardField">
      <span>{label}</span>
      <div className="wizardFieldInput">
        <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} min={0} />
        {suffix ? <span className="wizardFieldSuffix">{suffix}</span> : null}
      </div>
    </label>
  );
}

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(defaults);
  const [serviceMode, setServiceMode] = useState<"preset" | typeof CUSTOM_SERVICE>("preset");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFinish() {
    setStatus("submitting");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/onboarding/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();

      if (!response.ok || "error" in body) {
        setStatus("error");
        setErrorMessage("error" in body ? body.error : "Something went wrong.");
        return;
      }

      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <motion.div className="wizardSuccess" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <span className="heroBadgeDot" />
        <h2>Your CROO Agent is negotiation-enabled.</h2>
        <p>
          <strong>{form.sellerAgentId}</strong>{" "}
          is now registered with Parley&apos;s negotiation engine. Every order it receives will be negotiated
          automatically against the rules you just set — enforced by the deterministic engine on every single offer,
          never bypassed.
        </p>
        <div className="wizardSummaryGrid">
          <div>
            <span>Price floor</span>
            <strong>{form.minimumPrice} USDC</strong>
          </div>
          <div>
            <span>Target price</span>
            <strong>{form.preferredPrice} USDC</strong>
          </div>
          <div>
            <span>Max rounds</span>
            <strong>{form.maxRounds}</strong>
          </div>
          <div>
            <span>Standard delivery</span>
            <strong>{form.standardDeliveryDays}d</strong>
          </div>
        </div>

        <details className="advancedDetails">
          <summary>Advanced</summary>
          <dl>
            <div>
              <dt>Agent identifier</dt>
              <dd>{form.sellerAgentId}</dd>
            </div>
            <div>
              <dt>Service listing</dt>
              <dd>{form.service}</dd>
            </div>
          </dl>
        </details>

        <div className="heroCtaRow">
          <Link className="wizardBtnPrimary" href="/dashboard">
            Go to Dashboard
          </Link>
          <Link className="wizardBtnSecondary" href="/demo">
            Try a live negotiation
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="wizard">
      <ol className="wizardProgress">
        {stepLabels.map((label, index) => (
          <li key={label} className={index <= step ? "wizardProgressStep wizardProgressStep--active" : "wizardProgressStep"}>
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25 }}
          className="wizardCard"
        >
          {step === 0 ? (
            <div className="wizardStep">
              <p className="eyebrow">Step 1</p>
              <h2>Import your CROO Agent</h2>
              <p className="wizardStepNote">
                You already have an agent — its wallet, DID, and service listing live on the CROO Agent Store.
                Parley doesn&apos;t create a new one; it links to the agent you already registered there.
              </p>
              <a className="wizardExternalLink" href="https://agent.croo.network" target="_blank" rel="noreferrer">
                Open the CROO Agent Store &#8599;
              </a>
              <p className="wizardStepNote">
                Already have your agent open? Continue — the next step attaches negotiation rules to it.
              </p>
              <button type="button" className="wizardBtnPrimary" onClick={() => setStep(1)}>
                Continue
              </button>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="wizardStep">
              <p className="eyebrow">Step 2</p>
              <h2>Agent details</h2>
              <p className="wizardStepNote">Tell Parley which agent to negotiate on behalf of, and what it sells.</p>

              <label className="wizardField">
                <span>Agent name</span>
                <input
                  type="text"
                  placeholder="e.g. Ava — Copywriting Studio"
                  value={form.sellerAgentId}
                  onChange={(event) => update("sellerAgentId", event.target.value)}
                />
                <span className="wizardFieldHint">If your agent already has a name, use it here — you can edit it later.</span>
              </label>

              <label className="wizardField">
                <span>What does it sell?</span>
                <select
                  value={serviceMode === CUSTOM_SERVICE ? CUSTOM_SERVICE : form.service || ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === CUSTOM_SERVICE) {
                      setServiceMode(CUSTOM_SERVICE);
                      update("service", "");
                    } else {
                      setServiceMode("preset");
                      update("service", value);
                    }
                  }}
                >
                  <option value="" disabled>
                    Select a service
                  </option>
                  {serviceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value={CUSTOM_SERVICE}>Custom…</option>
                </select>
              </label>

              {serviceMode === CUSTOM_SERVICE ? (
                <label className="wizardField">
                  <span>Describe the service</span>
                  <input
                    type="text"
                    placeholder="e.g. Podcast editing"
                    value={form.service}
                    onChange={(event) => update("service", event.target.value)}
                  />
                </label>
              ) : null}

              <NumberField
                label="Standard delivery time"
                value={form.standardDeliveryDays}
                onChange={(value) => update("standardDeliveryDays", value)}
                suffix="days"
              />

              <div className="wizardActions">
                <button type="button" className="wizardBtnSecondary" onClick={() => setStep(0)}>
                  Back
                </button>
                <button
                  type="button"
                  className="wizardBtnPrimary"
                  disabled={!form.sellerAgentId.trim() || !form.service.trim()}
                  onClick={() => setStep(2)}
                >
                  Continue
                </button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="wizardStep">
              <p className="eyebrow">Step 3</p>
              <h2>Configure negotiation rules</h2>
              <p className="wizardStepNote">
                These are enforced by the deterministic engine on every offer — Parley can never accept below your
                floor, no matter what.
              </p>

              <div className="ruleGroups">
                <div className="ruleGroup">
                  <p className="ruleGroupTitle">Pricing</p>
                  <NumberField label="Minimum price (floor)" value={form.minimumPrice} onChange={(v) => update("minimumPrice", v)} suffix="USDC" />
                  <NumberField label="Preferred price" value={form.preferredPrice} onChange={(v) => update("preferredPrice", v)} suffix="USDC" />
                  <label className="wizardField">
                    <span>Payment preference</span>
                    <select disabled value="upfront">
                      <option value="upfront">Upfront (only option supported today)</option>
                    </select>
                  </label>
                </div>

                <div className="ruleGroup">
                  <p className="ruleGroupTitle">Delivery</p>
                  <NumberField label="Standard delivery" value={form.standardDeliveryDays} onChange={(v) => update("standardDeliveryDays", v)} suffix="days" />
                  <NumberField label="Rush fee" value={form.rushFee} onChange={(v) => update("rushFee", v)} suffix="USDC" />
                </div>

                <div className="ruleGroup">
                  <p className="ruleGroupTitle">Customer benefits</p>
                  <NumberField label="Bundle discount" value={form.bundleDiscount} onChange={(v) => update("bundleDiscount", v)} suffix="USDC" />
                  <NumberField
                    label="Recurring client discount"
                    value={form.recurringClientDiscount}
                    onChange={(v) => update("recurringClientDiscount", v)}
                    suffix="USDC"
                  />
                </div>

                <div className="ruleGroup">
                  <p className="ruleGroupTitle">Limits</p>
                  <NumberField label="Maximum rounds" value={form.maxRounds} onChange={(v) => update("maxRounds", v)} />
                  <NumberField label="Capacity" value={form.maximumWorkload} onChange={(v) => update("maximumWorkload", v)} suffix="orders" />
                </div>
              </div>

              <div className="wizardActions">
                <button type="button" className="wizardBtnSecondary" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  type="button"
                  className="wizardBtnPrimary"
                  disabled={form.preferredPrice < form.minimumPrice}
                  onClick={() => setStep(3)}
                >
                  Continue
                </button>
              </div>
              {form.preferredPrice < form.minimumPrice ? (
                <p className="wizardFieldError">Preferred price must be at or above your minimum price.</p>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="wizardStep">
              <p className="eyebrow">Step 4</p>
              <h2>Review &amp; finish</h2>
              <div className="wizardSummaryGrid">
                <div>
                  <span>Agent name</span>
                  <strong>{form.sellerAgentId}</strong>
                </div>
                <div>
                  <span>Service</span>
                  <strong>{form.service}</strong>
                </div>
                <div>
                  <span>Price floor</span>
                  <strong>{form.minimumPrice} USDC</strong>
                </div>
                <div>
                  <span>Preferred price</span>
                  <strong>{form.preferredPrice} USDC</strong>
                </div>
                <div>
                  <span>Rush fee</span>
                  <strong>{form.rushFee} USDC</strong>
                </div>
                <div>
                  <span>Bundle discount</span>
                  <strong>{form.bundleDiscount} USDC</strong>
                </div>
                <div>
                  <span>Recurring discount</span>
                  <strong>{form.recurringClientDiscount} USDC</strong>
                </div>
                <div>
                  <span>Max rounds</span>
                  <strong>{form.maxRounds}</strong>
                </div>
              </div>

              {errorMessage ? <p className="wizardFieldError">{errorMessage}</p> : null}

              <div className="wizardActions">
                <button type="button" className="wizardBtnSecondary" onClick={() => setStep(2)} disabled={status === "submitting"}>
                  Back
                </button>
                <button type="button" className="wizardBtnPrimary" onClick={handleFinish} disabled={status === "submitting"}>
                  {status === "submitting" ? "Activating…" : "Activate"}
                </button>
              </div>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
