import { closeDb } from "@/db";
import { demoResetAllowed, resetOperationalDemo } from "@/db/demo-reset";

if (!demoResetAllowed()) {
  throw new Error("Demo reset is disabled in production. Set DEMO_RESET_ENABLED=true only for an intentional demo environment.");
}

try {
  const result = await resetOperationalDemo();
  console.log(`Reset ${result.caseIds.join(", ")} to their deterministic local fixture state.`);
  console.log("No Razorpay object was cancelled or changed.");
} finally {
  await closeDb();
}
