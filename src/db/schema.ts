import {
  bigint,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const recoveryCaseStatus = pgEnum("recovery_case_status", [
  "OPEN",
  "RECOVERED",
]);

export const recoveryCases = pgTable(
  "recovery_cases",
  {
    id: text("id").primaryKey(),
    invoiceNumber: text("invoice_number").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    dueDate: date("due_date").notNull(),
    currency: text("currency").notNull().default("INR"),
    amountDue: bigint("amount_due", { mode: "number" }).notNull(),
    amountRecovered: bigint("amount_recovered", { mode: "number" })
      .notNull()
      .default(0),
    status: recoveryCaseStatus("status").notNull().default("OPEN"),
    razorpayPaymentLinkId: text("razorpay_payment_link_id"),
    razorpayPaymentLinkUrl: text("razorpay_payment_link_url"),
    recoveredAt: timestamp("recovered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("recovery_cases_invoice_number_unique").on(
      table.invoiceNumber,
    ),
    uniqueIndex("recovery_cases_payment_link_id_unique").on(
      table.razorpayPaymentLinkId,
    ),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    recoveryCaseId: text("recovery_case_id")
      .notNull()
      .references(() => recoveryCases.id, { onDelete: "restrict" }),
    razorpayPaymentId: text("razorpay_payment_id").notNull(),
    razorpayOrderId: text("razorpay_order_id"),
    razorpayPaymentLinkId: text("razorpay_payment_link_id").notNull(),
    razorpayEventId: text("razorpay_event_id").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    method: text("method").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payments_razorpay_payment_id_unique").on(
      table.razorpayPaymentId,
    ),
    uniqueIndex("payments_razorpay_event_id_unique").on(
      table.razorpayEventId,
    ),
    index("payments_recovery_case_id_index").on(table.recoveryCaseId),
  ],
);
