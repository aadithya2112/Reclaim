import {
  aws_budgets as budgets,
  aws_certificatemanager as acm,
  aws_cloudwatch as cloudwatch,
  aws_cloudwatch_actions as cloudwatchActions,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_kms as kms,
  aws_logs as logs,
  aws_secretsmanager as secretsmanager,
  aws_sns as sns,
  aws_sns_subscriptions as subscriptions,
  CfnOutput,
  CfnParameter,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";

const repositoryName = "recoup";
const secretName = "recoup/production";

export class RecoupFoundationStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const repository = new ecr.Repository(this, "Repository", {
      repositoryName,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      encryption: ecr.RepositoryEncryption.AES_256,
      emptyOnDelete: true,
      removalPolicy: RemovalPolicy.DESTROY,
      lifecycleRules: [{ maxImageCount: 10, description: "Retain the ten newest immutable releases" }],
    });

    const configuration = new secretsmanager.Secret(this, "Configuration", {
      secretName,
      description: "Recoup production runtime and migration configuration",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          DATABASE_URL: "REPLACE_BEFORE_DEPLOY",
          DATABASE_MIGRATION_URL: "REPLACE_BEFORE_DEPLOY",
          APP_URL: "https://recoup.aadithya.dev",
          RAZORPAY_KEY_ID: "REPLACE_BEFORE_DEPLOY",
          RAZORPAY_KEY_SECRET: "REPLACE_BEFORE_DEPLOY",
          RAZORPAY_WEBHOOK_SECRET: "REPLACE_BEFORE_DEPLOY",
          OPENROUTER_API_KEY: "REPLACE_BEFORE_DEPLOY",
          DEMO_RESET_ENABLED: "false",
        }),
        generateStringKey: "_bootstrap",
        excludePunctuation: true,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new CfnOutput(this, "RepositoryUri", { value: repository.repositoryUri });
    new CfnOutput(this, "ConfigurationSecretArn", { value: configuration.secretArn });

    NagSuppressions.addResourceSuppressions(configuration, [
      {
        id: "AwsSolutions-SMG4",
        reason: "The short-lived Test Mode demo uses manually rotated provider and database credentials; automatic rotation is not supported by those providers.",
      },
    ]);
  }
}

export class RecoupPlatformStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const certificateArn = new CfnParameter(this, "CertificateArn", {
      type: "String",
      description: "Validated ACM certificate ARN for recoup.aadithya.dev",
      allowedPattern: "^arn:aws:acm:ap-south-1:[0-9]{12}:certificate/[0-9a-f-]+$",
    });
    const imageDigest = new CfnParameter(this, "ImageDigest", {
      type: "String",
      description: "Immutable ECR image digest for the web service, including the sha256: prefix",
      allowedPattern: "^sha256:[0-9a-f]{64}$",
    });
    const migrationImageDigest = new CfnParameter(this, "MigrationImageDigest", {
      type: "String",
      description: "Immutable ECR image digest for the one-off migration task, including the sha256: prefix",
      allowedPattern: "^sha256:[0-9a-f]{64}$",
    });
    const alertEmail = new CfnParameter(this, "AlertEmail", {
      type: "String",
      noEcho: true,
      description: "Email destination for SNS alarms and budget notifications",
      allowedPattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
    });
    const monthlyBudgetUsd = new CfnParameter(this, "MonthlyBudgetUsd", {
      type: "Number",
      default: 25,
      minValue: 5,
      maxValue: 100,
      description: "Monthly cost budget in USD",
    });

    const repository = ecr.Repository.fromRepositoryName(this, "Repository", repositoryName);
    const configuration = secretsmanager.Secret.fromSecretNameV2(this, "Configuration", secretName);
    const certificate = acm.Certificate.fromCertificateArn(this, "Certificate", certificateArn.valueAsString);

    const vpc = new ec2.Vpc(this, "Vpc", {
      vpcName: "recoup",
      maxAzs: 2,
      natGateways: 0,
      restrictDefaultSecurityGroup: true,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    const loadBalancerSecurityGroup = new ec2.SecurityGroup(this, "LoadBalancerSecurityGroup", {
      vpc,
      allowAllOutbound: true,
      description: "Public HTTPS ingress to the Recoup application load balancer",
    });
    loadBalancerSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Cloudflare proxied HTTPS origin traffic");

    const serviceSecurityGroup = new ec2.SecurityGroup(this, "ServiceSecurityGroup", {
      vpc,
      allowAllOutbound: true,
      description: "Recoup tasks accept application traffic only from the load balancer",
    });
    serviceSecurityGroup.addIngressRule(loadBalancerSecurityGroup, ec2.Port.tcp(3000), "ALB to Recoup");

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName: "recoup",
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    const taskTrust = new iam.ServicePrincipal("ecs-tasks.amazonaws.com", {
      conditions: {
        StringEquals: { "aws:SourceAccount": this.account },
        ArnLike: { "aws:SourceArn": `arn:${this.partition}:ecs:${this.region}:${this.account}:*` },
      },
    });
    const executionRole = new iam.Role(this, "ExecutionRole", {
      assumedBy: taskTrust,
      roleName: "recoup-ecs-execution",
      description: "Pulls the Recoup image, reads its one configuration secret, and writes application logs",
    });
    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: taskTrust,
      roleName: "recoup-ecs-task",
      description: "Application role with no AWS API permissions",
    });

    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: "/ecs/recoup",
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    executionRole.addToPolicy(new iam.PolicyStatement({
      sid: "PullOnlyRecoupImages",
      actions: ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"],
      resources: [repository.repositoryArn],
    }));
    executionRole.addToPolicy(new iam.PolicyStatement({
      sid: "AcquireEcrAuthorizationToken",
      actions: ["ecr:GetAuthorizationToken"],
      resources: ["*"],
    }));
    configuration.grantRead(executionRole);

    const runtimePlatform = {
      cpuArchitecture: ecs.CpuArchitecture.X86_64,
      operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
    };
    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDefinition", {
      family: "recoup-web",
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole,
      taskRole,
      runtimePlatform,
    });
    const web = taskDefinition.addContainer("web", {
      containerName: "recoup",
      image: ecs.ContainerImage.fromRegistry(`${repository.repositoryUri}@${imageDigest.valueAsString}`),
      essential: true,
      readonlyRootFilesystem: true,
      stopTimeout: Duration.seconds(15),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "web", logGroup }),
      environment: {
        NODE_ENV: "production",
        APP_VERSION: imageDigest.valueAsString,
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(configuration, "DATABASE_URL"),
        APP_URL: ecs.Secret.fromSecretsManager(configuration, "APP_URL"),
        RAZORPAY_KEY_ID: ecs.Secret.fromSecretsManager(configuration, "RAZORPAY_KEY_ID"),
        RAZORPAY_KEY_SECRET: ecs.Secret.fromSecretsManager(configuration, "RAZORPAY_KEY_SECRET"),
        RAZORPAY_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(configuration, "RAZORPAY_WEBHOOK_SECRET"),
        OPENROUTER_API_KEY: ecs.Secret.fromSecretsManager(configuration, "OPENROUTER_API_KEY"),
        DEMO_RESET_ENABLED: ecs.Secret.fromSecretsManager(configuration, "DEMO_RESET_ENABLED"),
      },
      healthCheck: {
        command: ["CMD-SHELL", "wget -q -O - http://$(hostname):3000/api/health >/dev/null || exit 1"],
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        retries: 3,
        startPeriod: Duration.seconds(20),
      },
    });
    web.addPortMappings({ containerPort: 3000, protocol: ecs.Protocol.TCP });

    const migrationTaskDefinition = new ecs.FargateTaskDefinition(this, "MigrationTaskDefinition", {
      family: "recoup-migration",
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole,
      taskRole,
      runtimePlatform,
    });
    migrationTaskDefinition.addContainer("migration", {
      containerName: "recoup-migration",
      image: ecs.ContainerImage.fromRegistry(`${repository.repositoryUri}@${migrationImageDigest.valueAsString}`),
      command: ["node", "migration.mjs"],
      readonlyRootFilesystem: true,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "migration", logGroup }),
      secrets: {
        DATABASE_MIGRATION_URL: ecs.Secret.fromSecretsManager(configuration, "DATABASE_MIGRATION_URL"),
      },
    });

    const service = new ecs.FargateService(this, "Service", {
      cluster,
      serviceName: "recoup",
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [serviceSecurityGroup],
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      healthCheckGracePeriod: Duration.seconds(60),
      enableECSManagedTags: true,
      propagateTags: ecs.PropagatedTagSource.SERVICE,
    });

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", {
      vpc,
      internetFacing: true,
      loadBalancerName: "recoup",
      securityGroup: loadBalancerSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      dropInvalidHeaderFields: true,
    });
    const listener = loadBalancer.addListener("HttpsListener", {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [certificate],
      sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
      open: false,
    });
    const targetGroup = listener.addTargets("WebTargets", {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      deregistrationDelay: Duration.seconds(30),
      healthCheck: {
        path: "/api/health",
        healthyHttpCodes: "200",
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    const scaling = service.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 3 });
    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 60,
      scaleInCooldown: Duration.minutes(5),
      scaleOutCooldown: Duration.minutes(1),
    });
    scaling.scaleOnMemoryUtilization("MemoryScaling", {
      targetUtilizationPercent: 70,
      scaleInCooldown: Duration.minutes(5),
      scaleOutCooldown: Duration.minutes(1),
    });

    const alerts = new sns.Topic(this, "Alerts", {
      topicName: "recoup-alerts",
      displayName: "Recoup deployment alerts",
      enforceSSL: true,
      masterKey: kms.Alias.fromAliasName(this, "SnsKey", "alias/aws/sns"),
    });
    alerts.addSubscription(new subscriptions.EmailSubscription(alertEmail.valueAsString));

    const unhealthyHosts = new cloudwatch.Alarm(this, "UnhealthyHostsAlarm", {
      alarmName: "recoup-unhealthy-hosts",
      metric: targetGroup.metrics.unhealthyHostCount({ period: Duration.minutes(1) }),
      threshold: 1,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const serverErrors = new cloudwatch.Alarm(this, "ServerErrorsAlarm", {
      alarmName: "recoup-alb-5xx",
      metric: targetGroup.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, { period: Duration.minutes(1) }),
      threshold: 5,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const latency = new cloudwatch.Alarm(this, "LatencyAlarm", {
      alarmName: "recoup-target-p99-latency",
      metric: loadBalancer.metrics.targetResponseTime({ statistic: "p99", period: Duration.minutes(1) }),
      threshold: 3,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    for (const alarm of [unhealthyHosts, serverErrors, latency]) {
      alarm.addAlarmAction(new cloudwatchActions.SnsAction(alerts));
      alarm.addOkAction(new cloudwatchActions.SnsAction(alerts));
    }

    new budgets.CfnBudget(this, "Budget", {
      budget: {
        budgetName: "recoup-monthly",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: monthlyBudgetUsd.valueAsNumber, unit: "USD" },
      },
      notificationsWithSubscribers: [
        {
          notification: { notificationType: "FORECASTED", comparisonOperator: "GREATER_THAN", threshold: 80, thresholdType: "PERCENTAGE" },
          subscribers: [{ subscriptionType: "EMAIL", address: alertEmail.valueAsString }],
        },
        {
          notification: { notificationType: "ACTUAL", comparisonOperator: "GREATER_THAN", threshold: 100, thresholdType: "PERCENTAGE" },
          subscribers: [{ subscriptionType: "EMAIL", address: alertEmail.valueAsString }],
        },
      ],
    });

    new CfnOutput(this, "LoadBalancerDnsName", { value: loadBalancer.loadBalancerDnsName });
    new CfnOutput(this, "ApplicationUrl", { value: "https://recoup.aadithya.dev" });
    new CfnOutput(this, "WebhookUrl", { value: "https://recoup.aadithya.dev/api/webhooks/razorpay" });
    new CfnOutput(this, "ClusterName", { value: cluster.clusterName });
    new CfnOutput(this, "ServiceName", { value: service.serviceName });
    new CfnOutput(this, "MigrationTaskDefinitionArn", { value: migrationTaskDefinition.taskDefinitionArn });
    new CfnOutput(this, "PublicSubnetIds", { value: vpc.publicSubnets.map((subnet) => subnet.subnetId).join(",") });
    new CfnOutput(this, "ServiceSecurityGroupId", { value: serviceSecurityGroup.securityGroupId });
    new CfnOutput(this, "LogGroupName", { value: logGroup.logGroupName });

    NagSuppressions.addResourceSuppressions(loadBalancer, [
      {
        id: "AwsSolutions-ELB2",
        reason: "ALB access logs are omitted for the two-week cost-bounded demo; application logs and ALB metrics are retained in CloudWatch.",
      },
    ]);
    NagSuppressions.addResourceSuppressionsByPath(this, "/RecoupPlatform/LoadBalancer/Resource", [
      {
        id: "AwsSolutions-ELB2",
        reason: "ALB access logs are omitted for the two-week cost-bounded demo; application logs and ALB metrics are retained in CloudWatch.",
      },
    ]);
    NagSuppressions.addStackSuppressions(this, [
      {
        id: "AwsSolutions-VPC7",
        reason: "VPC flow logs are omitted for this short-lived synthetic/Test Mode environment to bound log cost; no customer or Live Mode data is permitted.",
      },
      {
        id: "AwsSolutions-ELB1",
        reason: "The ALB is intentionally public and sits behind Cloudflare; the task security group accepts traffic only from the ALB.",
      },
      {
        id: "AwsSolutions-ELB2",
        reason: "ALB access logs are omitted for the two-week cost-bounded demo; application logs and ALB metrics are retained in CloudWatch.",
      },
      {
        id: "AwsSolutions-ECS4",
        reason: "Container Insights is enabled using the current ECS v2 setting.",
      },
      {
        id: "AwsSolutions-ECS2",
        reason: "Only non-sensitive deployment metadata (NODE_ENV and the immutable image digest) is passed directly; all operational configuration is injected from Secrets Manager.",
      },
      {
        id: "AwsSolutions-EC23",
        reason: "The internet-facing ALB intentionally accepts only TCP 443 from Cloudflare and public HTTPS clients; ECS tasks allow port 3000 only from the ALB security group.",
      },
      {
        id: "AwsSolutions-IAM5",
        reason: "ECR authorization tokens are not resource-scopeable, and Secrets Manager ARNs require the generated six-character suffix wildcard.",
        appliesTo: ["Resource::*"],
      },
    ]);
  }
}
