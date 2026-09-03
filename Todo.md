# Remaining TODO

Completed work is recorded in `README.md` and `docs/plans/ai-revenue-recovery-revised-plan.md`. This file contains pending work only.

## AWS deployment and scalability proof

- [ ] Deploy the complete current application to a production-shaped, cost-conscious AWS environment using infrastructure as code.
  - Containerize the Next.js/Bun application and publish immutable images to Amazon ECR.
  - Run the web service on Amazon ECS with AWS Fargate behind an Application Load Balancer with HTTPS. Configure health checks and bounded horizontal scaling without changing recovery behavior.
  - Run PostgreSQL on Amazon RDS, apply Drizzle migrations through a controlled one-off deployment task, enable backups, and prove state survives application replacement.
  - Store Razorpay, OpenRouter, database, and reset configuration in AWS Secrets Manager or SSM Parameter Store. Use least-privilege IAM and keep secrets out of images, logs, source control, and client bundles.
  - Send application and deployment logs to CloudWatch; add actionable health/error alarms and a small cost budget. Document rollback and teardown so the demo environment does not become an uncontrolled expense.
  - Keep the deterministic demo reset disabled by default in production and enable it only through explicit protected configuration for the hackathon environment.
  - Verify the Recovery Frontier, Decision Replay, cached model replay, recorded no-ledger fallback, operational queue, database persistence, and responsive UI from the deployed HTTPS URL.
  - Add a concise architecture diagram and deployment/runbook evidence for judges. Present AWS as scalability and operational-readiness evidence, not as proof of real recovery uplift.
  - Done when: the repository can reproducibly provision, deploy, update, roll back, observe, and tear down the AWS stack; the public HTTPS application passes smoke and judge-journey checks; database state persists across a service redeploy; and no secret or synthetic/Test Mode provenance boundary is weakened.

## Razorpay hosted Test Mode proof

- [ ] Run the complete hosted Razorpay Test Mode flow against the deployed public HTTPS webhook endpoint in a later user-assisted session.
  - Still not verified: creating or reusing the real partial-enabled Payment Link, completing an exact ₹40,000 hosted checkout, and receiving Razorpay's signed webhook over the public internet.
  - What is verified: authenticated read-only Razorpay Test Mode API access; local database integration using representative signed `payment_link.partially_paid` and `payment_link.paid` payloads; duplicate and out-of-order protection.
  - Done when: `INV-003` moves from ₹75,000 to ₹35,000 exactly once, the authoritative ₹35,000 remainder promise becomes active, `INV-003` becomes `WAIT_PROTECTED`, and `INV-001` is promoted to `ACT_NOW`. Retain the Payment Link, payment, event, case, deployment, and CloudWatch correlation identifiers as Test Mode evidence.
  - Do not substitute the recorded fallback for this acceptance proof. The fallback is explicitly simulated and writes no ledger state.
