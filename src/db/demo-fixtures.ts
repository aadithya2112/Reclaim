import type { InferInsertModel } from "drizzle-orm";
import { recoveryCases } from "@/db/schema";

type RecoveryCaseInsert = InferInsertModel<typeof recoveryCases>;

export const DEMO_SEEDED_AT = new Date("2026-09-03T04:30:00.000Z");

export const DEMO_RECOVERY_CASES = [
  {
    id: "rc_m1_inv_001",
    invoiceNumber: "INV-001",
    customerName: "Acme Distribution Pvt. Ltd.",
    customerEmail: "finance@example.test",
    customerPhone: "+919876543210",
    dueDate: "2026-07-15",
    currency: "INR",
    amountDue: 5_000_000,
    amountRecovered: 0,
    status: "OPEN",
    operationalQueueStatus: "DEFERRED_CAPACITY",
    queuePriority: 80,
    createdAt: DEMO_SEEDED_AT,
    updatedAt: DEMO_SEEDED_AT,
  },
  {
    id: "rc_m1_inv_002",
    invoiceNumber: "INV-002",
    customerName: "Acme Distribution Pvt. Ltd.",
    customerEmail: "finance@example.test",
    customerPhone: "+919876543210",
    dueDate: "2026-07-31",
    currency: "INR",
    amountDue: 5_000_000,
    amountRecovered: 0,
    status: "OPEN",
    operationalQueueStatus: "DEFERRED_CAPACITY",
    queuePriority: 70,
    createdAt: DEMO_SEEDED_AT,
    updatedAt: DEMO_SEEDED_AT,
  },
  {
    id: "rc_m7_inv_003",
    invoiceNumber: "INV-003",
    customerName: "Northstar Components Pvt. Ltd.",
    customerEmail: "accounts@example.test",
    customerPhone: "+919876543211",
    dueDate: "2026-07-20",
    currency: "INR",
    amountDue: 7_500_000,
    amountRecovered: 0,
    status: "OPEN",
    operationalQueueStatus: "ACT_NOW",
    queuePriority: 100,
    createdAt: DEMO_SEEDED_AT,
    updatedAt: DEMO_SEEDED_AT,
  },
] satisfies RecoveryCaseInsert[];

export const DEMO_RECOVERY_CASE_IDS = DEMO_RECOVERY_CASES.map((item) => item.id);
