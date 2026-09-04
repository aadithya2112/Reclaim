# Recoup AWS deployment runbook

This runbook deploys the synthetic/Test Mode Recoup demo to AWS account `698268965353` in `ap-south-1`. It does not authorize real customer data or Razorpay Live Mode. AWS is container-hosting and operational-readiness evidence; Neon is an external public-network managed PostgreSQL dependency. Neither is recovery-uplift evidence.

## Fixed deployment boundary

- AWS CLI profile: `recoup-deployer` on every command
- Public hostname: `recoup.aadithya.dev`
- Webhook: `https://recoup.aadithya.dev/api/webhooks/razorpay`
- Runtime database: pooled TLS `DATABASE_URL`
- Migration database: direct TLS `DATABASE_MIGRATION_URL`
- ECS tasks: public subnets with public IPv4, no NAT Gateway, inbound port 3000 only from the ALB security group
- Scaling: one to three tasks
- Cloudflare remains authoritative DNS and terminates browser traffic before an ACM-backed HTTPS ALB origin

## Preflight

```bash
aws sts get-caller-identity --profile recoup-deployer --region ap-south-1
bun run lint
bun run typecheck
bun test
bun run build
docker build --platform linux/amd64 -t recoup:local .
AWS_PROFILE=recoup-deployer AWS_REGION=ap-south-1 AWS_DEFAULT_REGION=ap-south-1 bun run infra:synth
```

Do not continue unless the account is `698268965353`, the checks pass, and `cdk diff` has been reviewed. Never use the root profile.

## Certificate and Cloudflare validation

The current requested, non-exportable ACM certificate is:

```text
arn:aws:acm:ap-south-1:698268965353:certificate/69225b83-7bf2-483e-8189-6ad30611171b
```

Add this DNS-only Cloudflare record and wait for ACM status `ISSUED`:

```text
Type: CNAME
Name: _67dd043e69f8f392af0c45e4eb9ef0e9.recoup
Target: _38f300ae1a4128caf7416c71dc606033.jkddzztszm.acm-validations.aws
Proxy: DNS only
```

Verify without exposing any secret:

```bash
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:ap-south-1:698268965353:certificate/69225b83-7bf2-483e-8189-6ad30611171b \
  --profile recoup-deployer --region ap-south-1 \
  --query 'Certificate.Status' --output text
```

## Foundation and managed configuration

Deploy the ECR repository and Secrets Manager shell:

```bash
AWS_PROFILE=recoup-deployer AWS_REGION=ap-south-1 AWS_DEFAULT_REGION=ap-south-1 \
  bunx cdk diff RecoupFoundation --profile recoup-deployer
AWS_PROFILE=recoup-deployer AWS_REGION=ap-south-1 AWS_DEFAULT_REGION=ap-south-1 \
  bunx cdk deploy RecoupFoundation --profile recoup-deployer --require-approval never --progress events
```

Before deploying the platform, confirm that the Neon credentials belong only to the Recoup demo and that both local Neon URLs are current. Rotation is not required solely for this deployment when the existing credentials were not exposed and remain confined to the dedicated synthetic/Test Mode project. In the AWS console, replace the entire `recoup/production` secret value with a JSON object containing exactly these keys:

```text
DATABASE_URL
DATABASE_MIGRATION_URL
APP_URL
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
OPENROUTER_API_KEY
DEMO_RESET_ENABLED
```

Use the pooled Neon URI for `DATABASE_URL`, the direct Neon URI for `DATABASE_MIGRATION_URL`, `https://recoup.aadithya.dev` for `APP_URL`, Test Mode Razorpay credentials only, and `false` for `DEMO_RESET_ENABLED`. Existing Neon credentials are acceptable for this hackathon because the project is already dedicated to Recoup, located in Neon's Singapore AWS region, and limited to synthetic and Razorpay Test Mode data. Do not paste values into chat, shell arguments, CDK context, source control, or logs. The application task receives no AWS API permissions; only the ECS execution role can read this one secret.

## Build and push an immutable release

```bash
repository_uri=$(aws ecr describe-repositories --repository-names recoup \
  --profile recoup-deployer --region ap-south-1 \
  --query 'repositories[0].repositoryUri' --output text)
release_tag="release-$(date -u +%Y%m%d%H%M%S)"
aws ecr get-login-password --profile recoup-deployer --region ap-south-1 \
  | docker login --username AWS --password-stdin "${repository_uri%%/*}"
docker build --platform linux/amd64 --provenance=false --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" \
  -t "$repository_uri:$release_tag" .
docker push "$repository_uri:$release_tag"
image_digest=$(aws ecr describe-images --repository-name recoup \
  --image-ids imageTag="$release_tag" --profile recoup-deployer --region ap-south-1 \
  --query 'imageDetails[0].imageDigest' --output text)
```

The digest, not the human-readable tag, is the deployment identity. Retain the tag, digest, Git revision, build timestamp, and ECR scan result as deployment evidence.

## Deploy, migrate, and expose

Load `ALERT_EMAIL` locally without printing it. Pass it only to the CloudFormation `NoEcho` parameter. For the first release, deploy the platform with the same digest for the service and migration task, immediately run the migration, and do not add the public application DNS record until the migration succeeds.

```bash
ALERT_EMAIL=$(awk -F= '$1 == "ALERT_EMAIL" { sub(/^[^=]*=/, ""); print; exit }' .env.local)
certificate_arn='arn:aws:acm:ap-south-1:698268965353:certificate/69225b83-7bf2-483e-8189-6ad30611171b'
AWS_PROFILE=recoup-deployer AWS_REGION=ap-south-1 AWS_DEFAULT_REGION=ap-south-1 \
  bunx cdk diff RecoupPlatform --profile recoup-deployer \
  --method template
AWS_PROFILE=recoup-deployer AWS_REGION=ap-south-1 AWS_DEFAULT_REGION=ap-south-1 \
  bunx cdk deploy RecoupPlatform --profile recoup-deployer \
  --parameters CertificateArn="$certificate_arn" \
  --parameters ImageDigest="$image_digest" \
  --parameters MigrationImageDigest="$image_digest" \
  --parameters AlertEmail="$ALERT_EMAIL" \
  --require-approval never --progress events
```

Use the stack outputs to run the one-off migration task:

```bash
cluster=$(aws cloudformation describe-stacks --stack-name RecoupPlatform --profile recoup-deployer --region ap-south-1 --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' --output text)
migration_task=$(aws cloudformation describe-stacks --stack-name RecoupPlatform --profile recoup-deployer --region ap-south-1 --query 'Stacks[0].Outputs[?OutputKey==`MigrationTaskDefinitionArn`].OutputValue' --output text)
subnets=$(aws cloudformation describe-stacks --stack-name RecoupPlatform --profile recoup-deployer --region ap-south-1 --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnetIds`].OutputValue' --output text)
security_group=$(aws cloudformation describe-stacks --stack-name RecoupPlatform --profile recoup-deployer --region ap-south-1 --query 'Stacks[0].Outputs[?OutputKey==`ServiceSecurityGroupId`].OutputValue' --output text)
task_arn=$(aws ecs run-task --cluster "$cluster" --task-definition "$migration_task" --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$subnets],securityGroups=[$security_group],assignPublicIp=ENABLED}" \
  --profile recoup-deployer --region ap-south-1 --query 'tasks[0].taskArn' --output text)
aws ecs wait tasks-stopped --cluster "$cluster" --tasks "$task_arn" --profile recoup-deployer --region ap-south-1
aws ecs describe-tasks --cluster "$cluster" --tasks "$task_arn" --profile recoup-deployer --region ap-south-1 \
  --query 'tasks[0].containers[0].{ExitCode:exitCode,Reason:reason}' --output json
```

Require exit code `0`. The migration command also idempotently creates only the bounded `DEMO_RECOVERY_CASES` fixtures when they are absent. A successful current run logs `Database migrations and bounded demo seed completed successfully.` Then copy the `LoadBalancerDnsName` stack output into Cloudflare:

```text
Type: CNAME
Name: recoup
Target: recoup-1279496202.ap-south-1.elb.amazonaws.com
Proxy: Proxied
SSL/TLS mode: Full (strict)
```

Create a Cloudflare cache rule that bypasses cache for the exact path `/api/webhooks/razorpay`, and a security rule that prevents interactive challenges on that exact path. Do not bypass Recoup's raw-body HMAC verification, database idempotency, or other request validation.

## Safe updates and rollback

For a schema-changing release, preserve the currently deployed service digest. First deploy `RecoupPlatform` with `ImageDigest` set to the old digest and `MigrationImageDigest` set to the new digest. Run and verify the migration task. Only then deploy again with `ImageDigest` set to the new digest. Migrations must remain backward-compatible with the old task revision during rolling replacement.

ECS deployment circuit-breaker rollback is enabled. If application health fails, inspect `/ecs/recoup`, the target health reason, and ECS service events. To roll back application code, redeploy the previous known-good digest as `ImageDigest`; never overwrite an ECR tag. Database rollback must be an explicit forward migration because the checked-in Drizzle migrations are append-only.

## Acceptance evidence

Record identifiers, never secret values:

- CloudFormation stack IDs and deployment timestamps
- ECR image tag and immutable digest
- ECS task definition revision, stopped/started task ARNs, and service event timestamps
- ALB DNS name, target health, and `/api/health` response
- migration task ARN, exit code, and CloudWatch log stream
- known case and audit identifiers before and after ECS replacement
- Razorpay Test Mode Payment Link, payment, and webhook event IDs during the later hosted checkout

The persistence check proves Neon-backed state survives task replacement. Razorpay Test Mode proves integration behavior only. Synthetic comparisons remain simulated outcomes, and measured interpreter results remain model-decision evidence.

## Teardown

First remove the proxied `recoup` DNS record from Cloudflare so no new traffic reaches the environment. Retain only the evidence identifiers required for judging, then destroy in dependency order:

```bash
AWS_PROFILE=recoup-deployer AWS_REGION=ap-south-1 AWS_DEFAULT_REGION=ap-south-1 \
  bunx cdk destroy RecoupPlatform --profile recoup-deployer --force
AWS_PROFILE=recoup-deployer AWS_REGION=ap-south-1 AWS_DEFAULT_REGION=ap-south-1 \
  bunx cdk destroy RecoupFoundation --profile recoup-deployer --force
aws acm delete-certificate \
  --certificate-arn arn:aws:acm:ap-south-1:698268965353:certificate/69225b83-7bf2-483e-8189-6ad30611171b \
  --profile recoup-deployer --region ap-south-1
```

The ECR repository is configured to empty on stack deletion. Verify that the ECS service, ALB, CloudWatch log group, alarms, SNS topic, budget, ECR repository, VPC, secret, and ACM certificate are gone. The external Neon project and Cloudflare rules are not managed by CDK and must be removed separately when no longer needed.
