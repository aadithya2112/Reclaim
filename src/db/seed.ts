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
    },
  ])
  .onConflictDoNothing({ target: recoveryCases.id });

console.log("Seeded recovery cases INV-001 and INV-002.");
await closeDb();
