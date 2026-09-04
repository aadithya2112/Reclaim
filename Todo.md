# Remaining TODO

Completed work is recorded in `README.md` and `docs/plans/ai-revenue-recovery-revised-plan.md`. This file contains pending work only.

## AWS deployment and scalability proof

- [ ] Deploy the complete current application to a cost-conscious AWS compute environment using infrastructure as code, with managed PostgreSQL on Neon.
  - [x] Complete local deployment readiness: production image, standalone output, health endpoint, graceful shutdown, migration/runtime URL separation, one-off migration bundle, strict CDK synth, cdk-nag review, bootstrap, rollback/runbook, and local container smoke.
  - [x] Validate the requested ACM certificate, deploy the foundation stack, and publish an immutable ECR image.
  - [ ] Run hosted acceptance. Managed configuration, platform deployment, migration/seed, public Cloudflare routing, origin health, alarm checks, and Neon persistence across ECS replacement are complete. Cloudflare origin encryption should still be tightened from `Full` to `Full (strict)`.
  - Containerize the Next.js/Bun application and publish immutable images to Amazon ECR.
  - Run the web service on Amazon ECS with AWS Fargate behind an Application Load Balancer with HTTPS. Assign public IPv4 addresses to tasks so they can reach Neon, Razorpay, OpenRouter, ECR, and AWS control-plane endpoints without a NAT Gateway; allow inbound application traffic only from the load balancer security group. Configure health checks and bounded horizontal scaling without changing recovery behavior.
  - Use a dedicated Neon Free-plan PostgreSQL project in the Singapore AWS region, the closest currently available Neon region to the Mumbai application. Use a pooled TLS connection for the web service and a direct TLS connection for a controlled one-off Drizzle migration task. Prove state survives application replacement.
  - Treat the Neon Free-plan limits—100 CU-hours per project per month, 0.5 GB storage, 5 GB public network transfer, scale-to-zero, a six-hour restore window, and no Free-plan private networking/IP allowlist—as explicit hackathon-environment constraints. Monitor consumption and do not place real customer or Live Mode payment data in this environment.
  - Store Razorpay, OpenRouter, pooled database, direct migration, and reset configuration in AWS Secrets Manager or SSM Parameter Store. Use least-privilege IAM and a dedicated database role; keep secrets out of images, logs, source control, and client bundles.
  - Send application and deployment logs to CloudWatch; add actionable health/error alarms and a small cost budget. Document rollback and teardown so the demo environment does not become an uncontrolled expense.
  - Keep DNS on the existing Cloudflare zone. Use a DNS-validated, non-exportable ACM certificate on the Application Load Balancer and Cloudflare Full (strict) TLS. Bypass caching and interactive security challenges for `/api/webhooks/razorpay` without bypassing application signature verification.
  - Use `recoup.aadithya.dev` as the public application and webhook hostname. Output the generated ACM validation CNAME and the final ALB application CNAME for manual addition in Cloudflare; do not require a Cloudflare API token.
  - Keep the deterministic demo reset disabled by default in production and enable it only through explicit protected configuration for the hackathon environment.
  - Verify the Recovery Frontier, Decision Replay, cached model replay, recorded no-ledger fallback, operational queue, database persistence, and responsive UI from the deployed HTTPS URL.
  - Maintain the selected topology in [AWS + Neon deployment architecture](docs/plans/aws-neon-deployment-architecture.md), and add deployment/runbook evidence for judges. Present AWS as container-hosting and operational-readiness evidence, and Neon as an external managed PostgreSQL dependency with disclosed Free-plan and public-network limitations—not as proof of production isolation or real recovery uplift.
  - Done when: the repository can reproducibly provision, deploy, update, roll back, observe, and tear down the AWS resources; the public HTTPS application passes smoke and judge-journey checks; Neon state persists across an ECS service redeploy; the no-NAT outbound path works; and no secret or synthetic/Test Mode provenance boundary is weakened.

## Razorpay hosted Test Mode proof

- [ ] Run the complete hosted Razorpay Test Mode flow against the deployed public HTTPS webhook endpoint in a later user-assisted session.
  - Still not verified: creating or reusing the real partial-enabled Payment Link, completing an exact ₹40,000 hosted checkout, and receiving Razorpay's signed webhook over the public internet.
  - What is verified: authenticated read-only Razorpay Test Mode API access; local database integration using representative signed `payment_link.partially_paid` and `payment_link.paid` payloads; duplicate and out-of-order protection.
  - Done when: `INV-003` moves from ₹75,000 to ₹35,000 exactly once, the authoritative ₹35,000 remainder promise becomes active, `INV-003` becomes `WAIT_PROTECTED`, and `INV-001` is promoted to `ACT_NOW`. Retain the Payment Link, payment, event, case, deployment, and CloudWatch correlation identifiers as Test Mode evidence.
  - Do not substitute the recorded fallback for this acceptance proof. The fallback is explicitly simulated and writes no ledger state.
