import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { operationalAuditEvents, recoveryCases, recoveryProposals } from "@/db/schema";
import { auditValues, proposalFromJson } from "@/lib/operational-recovery";
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

    const [operationalProposal] = await db
      .select({ id: recoveryProposals.id })
      .from(recoveryProposals)
      .where(eq(recoveryProposals.recoveryCaseId, recoveryCase.id))
      .limit(1);
    if (recoveryCase.invoiceNumber === "INV-003" || operationalProposal) {
      if (!recoveryCase.approvedProposalId) {
        return Response.json(
          { error: "A human-approved policy-eligible proposal is required before collection handoff" },
          { status: 409 },
        );
      }
      const [approved] = await db
        .select()
        .from(recoveryProposals)
        .where(eq(recoveryProposals.id, recoveryCase.approvedProposalId))
        .limit(1);
      if (!approved) return Response.json({ error: "Approved proposal is unavailable" }, { status: 409 });
      const proposal = proposalFromJson(approved.proposal);
      if (!["OFFER_PARTIAL_PAYMENT", "SEND_PAYMENT_LINK"].includes(proposal.proposed_action)) {
        return Response.json({ error: "The approved action does not authorize a Payment Link" }, { status: 409 });
      }
    }

    if (
      recoveryCase.razorpayPaymentLinkId &&
      recoveryCase.razorpayPaymentLinkUrl
    ) {
      return Response.json({
        paymentLink: {
          id: recoveryCase.razorpayPaymentLinkId,
          shortUrl: recoveryCase.razorpayPaymentLinkUrl,
          acceptsPartial: Boolean(
            recoveryCase.razorpayPaymentLinkReferenceId &&
              recoveryCase.razorpayPaymentLinkAmount,
          ),
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
        razorpayPaymentLinkReferenceId: paymentLink.reference_id,
        razorpayPaymentLinkAmount: paymentLink.amount,
        paymentLinkStartingRecovered: recoveryCase.amountRecovered,
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
          referenceId: recoveryCases.razorpayPaymentLinkReferenceId,
          amount: recoveryCases.razorpayPaymentLinkAmount,
        })
        .from(recoveryCases)
        .where(eq(recoveryCases.id, recoveryCase.id))
        .limit(1);

      if (existingCase?.id && existingCase.shortUrl) {
        return Response.json({
          paymentLink: {
            id: existingCase.id,
            shortUrl: existingCase.shortUrl,
            acceptsPartial: Boolean(
              existingCase.referenceId && existingCase.amount,
            ),
          },
          reused: true,
        });
      }

      throw new Error("Payment Link was created but could not be persisted");
    }


    await db.insert(operationalAuditEvents).values(
      auditValues(
        recoveryCase.id,
        "RAZORPAY_ADAPTER",
        "PAYMENT_LINK_CREATED",
        "Approved bounded proposal handed off to a partial-enabled Razorpay Test Mode Payment Link.",
        "RAZORPAY TEST MODE",
        { paymentLinkId: updatedCase.id, referenceId: paymentLink.reference_id, amountPaise: paymentLink.amount, approvedProposalId: recoveryCase.approvedProposalId },
      ),
    );

    return Response.json({
      paymentLink: { ...updatedCase, acceptsPartial: true },
      reused: false,
    });
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
