import { closeDb, getDb } from "@/db";
import { DEMO_RECOVERY_CASES } from "@/db/demo-fixtures";
import { recoveryCases } from "@/db/schema";

const db = getDb();

await db
  .insert(recoveryCases)
  .values(DEMO_RECOVERY_CASES)
  .onConflictDoNothing({ target: recoveryCases.id });

console.log("Seeded recovery cases INV-001, INV-002, and INV-003.");
await closeDb();
