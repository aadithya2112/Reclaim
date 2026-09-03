import { demoResetAllowed, resetOperationalDemo } from "@/db/demo-reset";

export async function POST() {
  if (!demoResetAllowed()) {
    return Response.json(
      { error: "Demo reset is disabled in this environment" },
      { status: 403 },
    );
  }

  try {
    const result = await resetOperationalDemo();
    return Response.json({
      reset: true,
      ...result,
      warning: "Local fixture state was reset. Existing Razorpay Test Mode objects were not cancelled.",
    });
  } catch (error) {
    console.error("Scoped demo reset failed", error);
    return Response.json({ error: "Scoped demo reset failed" }, { status: 500 });
  }
}
