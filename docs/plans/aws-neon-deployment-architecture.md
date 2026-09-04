# AWS + Neon Deployment Architecture

Status: Public AWS/Cloudflare deployment and persistence verified; Full (strict) origin validation and hosted acceptance pending

This is a two-week, cost-conscious environment for synthetic receivables and Razorpay Test Mode evidence. It is not approved for real customer or Live Mode payment data.

Public hostname: `recoup.aadithya.dev`

## Architecture decision

```text
Judge / Razorpay Test Mode
            |
            | HTTPS
            v
Cloudflare DNS and proxy (`recoup.aadithya.dev`)
            |
            | Full (strict) TLS
            v
AWS Application Load Balancer + ACM certificate
            |
            | security-group-authorized application traffic
            v
ECS Fargate service in public subnets
  - public IPv4 for outbound access
  - no NAT Gateway
  - no direct application ingress from the internet
            |
            | PostgreSQL over TLS
            v
Neon PostgreSQL, AWS Singapore region
```

Amazon ECR supplies immutable container images. AWS Secrets Manager or SSM Parameter Store supplies server-only configuration. CloudWatch receives application and deployment logs and alarms. A controlled one-off Fargate task applies Drizzle migrations before a service update.

## Network boundary

- The Application Load Balancer accepts public HTTPS traffic.
- Each Fargate task receives a public IPv4 address because there is no NAT Gateway. Its security group accepts the application port only from the load balancer security group.
- Tasks initiate outbound TLS connections to Neon, Razorpay, OpenRouter, ECR, and required AWS endpoints.
- Neon is reached through its public TLS endpoint. Free-plan private networking and IP allowlisting are not assumed.
- Cloudflare is configured not to cache or apply an interactive challenge to `/api/webhooks/razorpay`. Recoup still verifies the Razorpay raw-body HMAC signature and deduplicates events in PostgreSQL; an unsigned public request was verified to fail with `401`.
- ACM validation is complete. The proxied application CNAME `recoup` targets `recoup-1279496202.ap-south-1.elb.amazonaws.com`; the exact validation record is retained in the deployment runbook.

## Neon project selection

The selected existing Neon project satisfies the deployment boundary:

- Plan: Free
- Cloud: AWS
- Region: Singapore, the closest currently offered Neon AWS region to the Mumbai ECS service
- PostgreSQL version: the current Neon default supported by the application
- Database: a dedicated database for Recoup
- Credentials: confined to this Recoup-only synthetic and Razorpay Test Mode project

In Neon's **Connection string** selector, choose **Node.js**. The application uses the `postgres` Node package through `drizzle-orm/postgres-js`; it does not use Prisma or Neon's serverless HTTP driver.

Create two secret values:

1. `DATABASE_URL`: enable **Pooled connection**, copy the Node.js connection URI, and retain its TLS query parameters. The hostname contains `-pooler`. ECS web tasks use this value.
2. `DATABASE_MIGRATION_URL`: disable **Pooled connection**, copy the direct Node.js connection URI, and retain its TLS query parameters. Only the controlled migration task uses this value.

Do not paste either value into chat, commit it, or place it in a container image. The deployment implementation must update Drizzle migration configuration to prefer `DATABASE_MIGRATION_URL`, while the running application continues to use `DATABASE_URL`.

## Free-plan boundaries

The selected Neon Free plan currently provides 100 CU-hours per project per month, 0.5 GB storage, 5 GB public network transfer, scale-to-zero after inactivity, and a limited restore window. These are operational ceilings, not targets. The deployment must monitor consumption, keep the dataset small, and fail visibly rather than silently substituting simulated persistence if a limit is reached.

## Persistence acceptance

1. Record a known case state and audit identifiers in Neon.
2. replace the running ECS task with a new image or task definition revision.
3. Confirm the old task is stopped and the new task is healthy.
4. Read the same case and audit identifiers through the new task.
5. Retain deployment and database evidence showing that state survived application replacement.

This proves externalized managed persistence. It must be described as Neon persistence, not Amazon RDS persistence or a private VPC database.

## References

- [Neon plans](https://neon.com/pricing)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Neon security overview](https://neon.com/docs/security/security-overview)
- [Drizzle with Neon](https://orm.drizzle.team/docs/tutorials/drizzle-with-neon)
- [AWS Certificate Manager DNS validation](https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html)
- [Cloudflare Full (strict) TLS](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
