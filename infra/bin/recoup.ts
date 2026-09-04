#!/usr/bin/env node
import { App, Aspects } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { RecoupFoundationStack, RecoupPlatformStack } from "../lib/recoup-stack";

const app = new App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT ?? "698268965353",
  region: process.env.CDK_DEFAULT_REGION ?? "ap-south-1",
};

new RecoupFoundationStack(app, "RecoupFoundation", { env });
new RecoupPlatformStack(app, "RecoupPlatform", { env });

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
