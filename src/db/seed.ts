import { closeDb, getDb } from "@/db";
import { recoveryCases } from "@/db/schema";

const db = getDb();

await db
  .insert(recoveryCases)
  .values([
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
    },
  ])
  .onConflictDoNothing({ target: recoveryCases.id });

console.log("Seeded recovery cases INV-001, INV-002, and INV-003.");
await closeDb();
