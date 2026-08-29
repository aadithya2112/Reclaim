import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { payments, recoveryCases } from "@/db/schema";

export type RecoveryCaseSnapshot = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  dueDate: string;
  currency: string;
  amountDue: number;
  amountRecovered: number;
  status: "OPEN" | "RECOVERED";
  razorpayPaymentLinkId: string | null;
  razorpayPaymentLinkUrl: string | null;
  recoveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  payments: Array<{
    id: string;
    razorpayPaymentId: string;
    razorpayOrderId: string | null;
    amount: number;
    currency: string;
    method: string;
    capturedAt: string;
  }>;
};

export async function getRecoveryCaseSnapshot(
  id: string,
): Promise<RecoveryCaseSnapshot | null> {
  const db = getDb();
  const [recoveryCase] = await db
    .select()
    .from(recoveryCases)
    .where(eq(recoveryCases.id, id))
    .limit(1);

  if (!recoveryCase) return null;

  const casePayments = await db
    .select()
    .from(payments)
    .where(eq(payments.recoveryCaseId, id))
    .orderBy(asc(payments.capturedAt));

  return {
    ...recoveryCase,
    recoveredAt: recoveryCase.recoveredAt?.toISOString() ?? null,
    createdAt: recoveryCase.createdAt.toISOString(),
    updatedAt: recoveryCase.updatedAt.toISOString(),
    payments: casePayments.map((payment) => ({
      id: payment.id,
      razorpayPaymentId: payment.razorpayPaymentId,
      razorpayOrderId: payment.razorpayOrderId,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      capturedAt: payment.capturedAt.toISOString(),
    })),
  };
}

export function recoveryStatusFor(amountDue: number, amountRecovered: number) {
  return amountRecovered >= amountDue ? "RECOVERED" : "OPEN";
}
