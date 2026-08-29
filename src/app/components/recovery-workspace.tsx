"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RecoveryCaseSnapshot } from "@/lib/recovery";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const date = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

function formatMinorUnits(amount: number) {
  return money.format(amount / 100);
}

function FlowStep({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string;
  state: "complete" | "current" | "waiting";
}) {
  return (
    <li className={`flow-step flow-step--${state}`}>
      <span className="flow-marker" aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
    </li>
  );
}

export function RecoveryWorkspace({
  initialCase,
}: {
  initialCase: RecoveryCaseSnapshot;
}) {
  const [recoveryCase, setRecoveryCase] = useState(initialCase);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRecovered = recoveryCase.status === "RECOVERED";
  const hasPaymentLink = Boolean(recoveryCase.razorpayPaymentLinkUrl);
  const outstanding = Math.max(
    0,
    recoveryCase.amountDue - recoveryCase.amountRecovered,
  );

  const refreshCase = useCallback(async () => {
    const response = await fetch(`/api/recovery-cases/${recoveryCase.id}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const body = (await response.json()) as {
      recoveryCase: RecoveryCaseSnapshot;
    };
    setRecoveryCase(body.recoveryCase);
  }, [recoveryCase.id]);

  useEffect(() => {
    if (!hasPaymentLink || isRecovered) return;

    const interval = window.setInterval(() => void refreshCase(), 2_500);
    return () => window.clearInterval(interval);
  }, [hasPaymentLink, isRecovered, refreshCase]);

  const recoveredPercent = useMemo(
    () =>
      Math.min(
        100,
        Math.round(
          (recoveryCase.amountRecovered / recoveryCase.amountDue) * 100,
        ),
      ),
    [recoveryCase.amountDue, recoveryCase.amountRecovered],
  );

  async function createPaymentLink() {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/recovery-cases/${recoveryCase.id}/payment-link`,
        { method: "POST" },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Payment Link creation failed");
      await refreshCase();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Recoup home">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span>recoup</span>
        </a>
        <div className="environment">
          <span className="environment-dot" /> Razorpay test mode
        </div>
      </header>

      <div className="workspace" id="top">
        <section className="case-main" aria-labelledby="case-title">
          <div className="case-heading">
            <div>
              <p className="eyebrow">Recovery case · {recoveryCase.id}</p>
              <h1 id="case-title">{recoveryCase.invoiceNumber}</h1>
              <p className="customer-name">{recoveryCase.customerName}</p>
            </div>
            <span className={`status status--${recoveryCase.status.toLowerCase()}`}>
              <span aria-hidden="true" /> {recoveryCase.status}
            </span>
          </div>

          <div className="amount-block">
            <p>Outstanding</p>
            <strong>{formatMinorUnits(outstanding)}</strong>
            <div className="amount-progress" aria-label={`${recoveredPercent}% recovered`}>
              <span style={{ width: `${recoveredPercent}%` }} />
            </div>
            <div className="amount-caption">
              <span>{formatMinorUnits(recoveryCase.amountRecovered)} recovered</span>
              <span>{formatMinorUnits(recoveryCase.amountDue)} invoice total</span>
            </div>
          </div>

          <dl className="case-facts">
            <div>
              <dt>Due date</dt>
              <dd>{date.format(new Date(`${recoveryCase.dueDate}T00:00:00+05:30`))}</dd>
            </div>
            <div>
              <dt>Customer email</dt>
              <dd>{recoveryCase.customerEmail}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{recoveryCase.currency}</dd>
            </div>
          </dl>

          <section className="payments-section" aria-labelledby="payments-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Ledger</p>
                <h2 id="payments-title">Captured payments</h2>
              </div>
              <span>{recoveryCase.payments.length}</span>
            </div>

            {recoveryCase.payments.length === 0 ? (
              <div className="empty-state">
                <span>—</span>
                <p>No captured payments yet. Verified Razorpay webhooks appear here.</p>
              </div>
            ) : (
              <div className="payment-table" role="table" aria-label="Captured payments">
                {recoveryCase.payments.map((payment) => (
                  <div className="payment-row" role="row" key={payment.id}>
                    <div role="cell">
                      <strong>{payment.razorpayPaymentId}</strong>
                      <span>{dateTime.format(new Date(payment.capturedAt))}</span>
                    </div>
                    <div role="cell">
                      <span>{payment.method.toUpperCase()}</span>
                      <strong>{formatMinorUnits(payment.amount)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>

        <aside className="case-inspector" aria-label="Recovery workflow">
          <div className="inspector-head">
            <p className="eyebrow">Collection path</p>
            <h2>{isRecovered ? "Payment recovered" : "Recovery in progress"}</h2>
            <p>
              {isRecovered
                ? "The verified payment has been recorded against this case."
                : hasPaymentLink
                  ? "The link is ready. Case state changes only after a signed webhook."
                  : "Create a hosted checkout for the full outstanding amount."}
            </p>
          </div>

          <ol className="flow-list">
            <FlowStep label="Invoice overdue" detail="Synthetic fixture loaded" state="complete" />
            <FlowStep label="Recovery case" detail="Owned by this application" state="complete" />
            <FlowStep
              label="Payment Link"
              detail={hasPaymentLink ? "Created in Razorpay" : "Not created"}
              state={hasPaymentLink ? "complete" : "current"}
            />
            <FlowStep
              label="Verified webhook"
              detail={isRecovered ? "Signature accepted" : "Awaiting payment"}
              state={isRecovered ? "complete" : hasPaymentLink ? "current" : "waiting"}
            />
            <FlowStep
              label="Recovered"
              detail={isRecovered ? "Case closed" : "Pending"}
              state={isRecovered ? "complete" : "waiting"}
            />
          </ol>

          <div className="inspector-action">
            {!hasPaymentLink ? (
              <button type="button" onClick={createPaymentLink} disabled={isCreating}>
                {isCreating ? "Creating secure link…" : "Create test payment link"}
              </button>
            ) : !isRecovered ? (
              <a
                className="primary-action"
                href={recoveryCase.razorpayPaymentLinkUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
              >
                Open Razorpay checkout <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <div className="success-note">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>Recovery complete</strong>
                  <p>{recoveryCase.recoveredAt ? dateTime.format(new Date(recoveryCase.recoveredAt)) : "Recorded"}</p>
                </div>
              </div>
            )}

            {hasPaymentLink && !isRecovered ? (
              <p className="polling-note">
                <span aria-hidden="true" /> Awaiting verified webhook
              </p>
            ) : null}

            {error ? <p className="error-note" role="alert">{error}</p> : null}
          </div>

          {recoveryCase.razorpayPaymentLinkId ? (
            <div className="external-reference">
              <span>Razorpay Payment Link</span>
              <code>{recoveryCase.razorpayPaymentLinkId}</code>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
