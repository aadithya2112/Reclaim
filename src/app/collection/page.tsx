import { RecoveryWorkspace, type Replay } from "@/app/components/recovery-workspace";
import { getRecoveryCaseSnapshot } from "@/lib/recovery";
import { getOperationalReplay } from "@/lib/operational-recovery";
import Link from "next/link";

export const dynamic = "force-dynamic";

const MILESTONE_CASE_ID = "rc_m7_inv_003";

export default async function CollectionPage() {
  const [recoveryCase, replay] = await Promise.all([
    getRecoveryCaseSnapshot(MILESTONE_CASE_ID),
    getOperationalReplay(MILESTONE_CASE_ID),
  ]);

  if (!recoveryCase) {
    return (
      <main className="setup-shell">
        <p className="eyebrow">Setup required</p>
        <h1>Seed the recovery case.</h1>
        <p>
          Run <code>bun run db:migrate</code>, then <code>bun run db:seed</code>,
          and reload this page.
        </p>
        <Link className="setup-back" href="/">Return to Recovery Frontier</Link>
      </main>
    );
  }

  return <RecoveryWorkspace initialCase={recoveryCase} initialReplay={replay as Replay} />;
}
