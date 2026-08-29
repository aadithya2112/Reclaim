import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { recoveryCases } from "@/db/schema";
import {
  createRazorpayPaymentLink,
  RazorpayApiError,
} from "@/lib/razorpay";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const db = getDb();
    const [recoveryCase] = await db
      .select()
      .from(recoveryCases)
      .where(eq(recoveryCases.id, id))
      .limit(1);

    if (!recoveryCase) {
      return Response.json({ error: "Recovery case not found" }, { status: 404 });
    }

    if (recoveryCase.status === "RECOVERED") {
      return Response.json(
        { error: "This recovery case is already recovered" },
        { status: 409 },
      );
    }

    if (
      recoveryCase.razorpayPaymentLinkId &&
      recoveryCase.razorpayPaymentLinkUrl
    ) {
      return Response.json({
        paymentLink: {
          id: recoveryCase.razorpayPaymentLinkId,
          shortUrl: recoveryCase.razorpayPaymentLinkUrl,
        },
        reused: true,
      });
    }

    const outstandingAmount =
      recoveryCase.amountDue - recoveryCase.amountRecovered;
    const paymentLink = await createRazorpayPaymentLink({
      recoveryCaseId: recoveryCase.id,
      invoiceNumber: recoveryCase.invoiceNumber,
      amount: outstandingAmount,
      currency: recoveryCase.currency,
    });

    const [updatedCase] = await db
      .update(recoveryCases)
      .set({
        razorpayPaymentLinkId: paymentLink.id,
        razorpayPaymentLinkUrl: paymentLink.short_url,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(recoveryCases.id, recoveryCase.id),
          isNull(recoveryCases.razorpayPaymentLinkId),
        ),
      )
      .returning({
        id: recoveryCases.razorpayPaymentLinkId,
        shortUrl: recoveryCases.razorpayPaymentLinkUrl,
      });

    if (!updatedCase?.id || !updatedCase.shortUrl) {
      const [existingCase] = await db
        .select({
          id: recoveryCases.razorpayPaymentLinkId,
          shortUrl: recoveryCases.razorpayPaymentLinkUrl,
        })
        .from(recoveryCases)
        .where(eq(recoveryCases.id, recoveryCase.id))
        .limit(1);

      if (existingCase?.id && existingCase.shortUrl) {
        return Response.json({ paymentLink: existingCase, reused: true });
      }

      throw new Error("Payment Link was created but could not be persisted");
    }

    return Response.json({ paymentLink: updatedCase, reused: false });
  } catch (error) {
    if (error instanceof RazorpayApiError) {
      return Response.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : error.status },
      );
    }

    console.error("Failed to create Payment Link", error);
    return Response.json(
      { error: "Unable to create the Payment Link" },
      { status: 500 },
    );
  }
}
