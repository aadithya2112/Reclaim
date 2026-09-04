import type { CommitmentProposal } from "@/lib/commitment-interpreter";

export type Replay = {
  approvedProposalId: string | null;
  messages: Array<{ id: string; body: string; receivedAt: string }>;
  runs: Array<{ id: string; status: string; modelId: string; providerName: string | null; privacyMode: string | null; failureCode: string | null; canonicalInputHash: string; promptVersion: string; schemaVersion: string }>;
  proposals: Array<{ id: string; customerMessageId: string; decisionRunId: string | null; revision: number; source: string; proposalHash: string; proposal: CommitmentProposal }>;
  policies: Array<{ proposalId: string; outcome: string; reasons: string[] }>;
  approvals: Array<{ proposalId: string; decision: string; reviewer: string; overrideProposalId: string | null }>;
  promises: Array<{ id: string; proposalId: string; promisedDate: string; amountPaise: number | null; status: string; activationRazorpayEventId: string | null }>;
  audit: Array<{ id: string; eventType: string; detail: string; actor: string; evidenceLabel: string; payloadHash: string; createdAt: string }>;
  queue: Array<{ id: string; invoiceNumber: string; customerName: string; outstandingPaise: number; queueStatus: string; queuePriority: number }>;
};
