export const RECORDED_PAYMENT_FALLBACK = {
  version: "recorded-payment-fallback-v1",
  evidenceLabel: "RECORDED SIMULATION — NO LEDGER WRITE",
  source: "Deterministic rehearsal fixture",
  input: {
    invoiceNumber: "INV-003",
    startingOutstandingPaise: 7_500_000,
    illustratedPaymentPaise: 4_000_000,
  },
  illustratedOutcome: {
    outstandingPaise: 3_500_000,
    promiseAmountPaise: 3_500_000,
    promiseStatus: "WAIT_PROTECTED",
    promotedInvoiceNumber: "INV-001",
    promotedQueueStatus: "ACT_NOW",
  },
  assertions: {
    razorpayInvoked: false,
    signatureVerified: false,
    ledgerWritten: false,
    recoveryMetricChanged: false,
  },
} as const;
