import { z } from "zod";
import { getRazorpayEnv } from "@/lib/env";

const env = getRazorpayEnv();
const response = await fetch("https://api.razorpay.com/v1/payment_links?count=1", {
  headers: { Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}` },
  cache: "no-store",
});
const body: unknown = await response.json().catch(() => null);
if (!response.ok) throw new Error(`Razorpay Test Mode read-only authentication smoke failed (${response.status})`);
const parsed = z.object({ payment_links: z.array(z.object({ id: z.string().startsWith("plink_") }).passthrough()) }).safeParse(body);
if (!parsed.success) {
  const shape = body && typeof body === "object" ? Object.keys(body).join(",") : String(body);
  throw new Error(`Razorpay returned an unexpected Payment Link collection response (${shape}): ${parsed.error.issues.map((issue) => `${issue.path.join(".")}:${issue.code}`).join(", ")}`);
}
console.log(JSON.stringify({ authenticated: true, mode: "TEST", operation: "READ_ONLY_LIST_PAYMENT_LINKS", status: response.status, returnedItems: parsed.data.payment_links.length }, null, 2));
