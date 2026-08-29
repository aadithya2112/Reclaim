import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
});

const razorpayEnvSchema = databaseEnvSchema.extend({
  APP_URL: z.string().url(),
  RAZORPAY_KEY_ID: z.string().startsWith("rzp_test_", {
    message: "RAZORPAY_KEY_ID must be a Razorpay Test Mode key",
  }),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
});

export function getDatabaseEnv() {
  return databaseEnvSchema.parse(process.env);
}

export function getRazorpayEnv() {
  return razorpayEnvSchema.parse(process.env);
}
