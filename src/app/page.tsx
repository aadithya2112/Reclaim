import { RecoveryWorkspace } from "@/app/components/recovery-workspace";
import { getRecoveryCaseSnapshot } from "@/lib/recovery";

export const dynamic = "force-dynamic";

const MILESTONE_CASE_ID = "rc_m1_inv_002";

export default async function Home() {
  const recoveryCase = await getRecoveryCaseSnapshot(MILESTONE_CASE_ID);

  if (!recoveryCase) {
    return (
      <main className="setup-shell">
        <p className="eyebrow">Setup required</p>
        <h1>Seed the recovery case.</h1>
        <p>
          Run <code>bun run db:migrate</code>, then <code>bun run db:seed</code>,
          and reload this page.
        </p>
      </main>
    );
  }

  return <RecoveryWorkspace initialCase={recoveryCase} />;
}
