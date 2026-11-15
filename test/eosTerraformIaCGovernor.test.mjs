/**
 * Glorian System — Terraform IaC Governance Test Suite
 * Governed by SPEC-276 / CHANGE-138
 *
 * Verifies BDD-1431 through BDD-1436.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EosTerraformIaCGovernor } from "../src/core/eosTerraformIaCGovernor.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const COMPLIANT_IAC_DIR = path.join(ROOT, "templates/iac/glorian-enterprise-infra");

describe("SPEC-276: Terraform IaC Governor", () => {
  // -------------------------------------------------------------------------
  // BDD-1431: IaC Validation & Canonical Formatting
  // -------------------------------------------------------------------------
  it("BDD-1431: validates compliant Terraform module syntax and canonical formatting", () => {
    const report = EosTerraformIaCGovernor.validateIaC(COMPLIANT_IAC_DIR);

    assert.equal(report.status, "PASS");
    assert.equal(report.clean, true);
    assert.equal(typeof report.latencyMs, "number");
    assert.equal(typeof report.sha256Receipt, "string");
    assert.equal(report.sha256Receipt.length, 64);
  });

  // -------------------------------------------------------------------------
  // BDD-1432: Clean Plan Audit
  // -------------------------------------------------------------------------
  it("BDD-1432: passes compliant Terraform plan with 0 security violations", () => {
    const compliantPlan = {
      resource_changes: [
        {
          address: "aws_security_group.app_sg",
          type: "aws_security_group",
          change: {
            actions: ["create"],
            after: {
              name: "glorian-internal-sg",
              ingress: [
                {
                  from_port: 443,
                  to_port: 443,
                  protocol: "tcp",
                  cidr_blocks: ["10.0.0.0/16"],
                },
              ],
            },
          },
        },
        {
          address: "aws_ebs_volume.data_vol",
          type: "aws_ebs_volume",
          change: {
            actions: ["create"],
            after: {
              size: 50,
              encrypted: true,
            },
          },
        },
        {
          address: "aws_db_instance.primary_db",
          type: "aws_db_instance",
          change: {
            actions: ["create"],
            after: {
              instance_class: "db.t3.medium",
              storage_encrypted: true,
            },
          },
        },
      ],
    };

    const report = EosTerraformIaCGovernor.auditPlan(compliantPlan);

    assert.equal(report.status, "PASS");
    assert.equal(report.allowed, true);
    assert.equal(report.violations.length, 0);
    assert.equal(report.totalViolations, 0);
  });

  // -------------------------------------------------------------------------
  // BDD-1433: Rejection of Insecure Ingress Rules
  // -------------------------------------------------------------------------
  it("BDD-1433: rejects security group with public ingress on sensitive ports (22, 5432)", () => {
    const insecureIngressPlan = {
      resource_changes: [
        {
          address: "aws_security_group.insecure_sg",
          type: "aws_security_group",
          change: {
            actions: ["create"],
            after: {
              name: "insecure-sg",
              ingress: [
                {
                  from_port: 22,
                  to_port: 22,
                  protocol: "tcp",
                  cidr_blocks: ["0.0.0.0/0"],
                },
                {
                  from_port: 5432,
                  to_port: 5432,
                  protocol: "tcp",
                  cidr_blocks: ["0.0.0.0/0"],
                },
              ],
            },
          },
        },
      ],
    };

    const report = EosTerraformIaCGovernor.auditPlan(insecureIngressPlan);

    assert.equal(report.status, "POLICY_VIOLATION");
    assert.equal(report.allowed, false);
    assert.ok(report.violations.length >= 1);
    assert.ok(report.violations.some((v) => v.rule === "no_public_ingress"));
  });

  // -------------------------------------------------------------------------
  // BDD-1434: Rejection of Unencrypted Storage and Public S3 Buckets
  // -------------------------------------------------------------------------
  it("BDD-1434: rejects unencrypted storage volumes and public S3 bucket configurations", () => {
    const insecureStoragePlan = {
      resource_changes: [
        {
          address: "aws_ebs_volume.unencrypted_vol",
          type: "aws_ebs_volume",
          change: {
            actions: ["create"],
            after: {
              size: 100,
              encrypted: false,
            },
          },
        },
        {
          address: "aws_s3_bucket.public_bucket",
          type: "aws_s3_bucket",
          change: {
            actions: ["create"],
            after: {
              bucket: "glorian-leaked-bucket",
              acl: "public-read",
            },
          },
        },
      ],
    };

    const report = EosTerraformIaCGovernor.auditPlan(insecureStoragePlan);

    assert.equal(report.status, "POLICY_VIOLATION");
    assert.equal(report.allowed, false);
    assert.ok(report.violations.some((v) => v.rule === "enforce_encryption_at_rest"));
    assert.ok(report.violations.some((v) => v.rule === "no_public_storage"));
  });

  // -------------------------------------------------------------------------
  // BDD-1435: Guarded Database Deletion
  // -------------------------------------------------------------------------
  it("BDD-1435: blocks database resource deletion without explicit allow_destroy authorization", () => {
    const deletionPlan = {
      resource_changes: [
        {
          address: "aws_db_instance.prod_cluster",
          type: "aws_db_instance",
          change: {
            actions: ["delete"],
            before: {
              id: "prod-db-01",
              storage_encrypted: true,
            },
          },
        },
      ],
    };

    // 1. Without allowDestroy flag -> BLOCKED
    const blockedReport = EosTerraformIaCGovernor.auditPlan(deletionPlan, {
      allowDestroy: false,
    });
    assert.equal(blockedReport.status, "DESTRUCTION_REJECTED");
    assert.equal(blockedReport.allowed, false);
    assert.ok(blockedReport.violations.some((v) => v.rule === "no_unauthorized_deletion"));

    // 2. With allowDestroy flag -> ALLOWED
    const allowedReport = EosTerraformIaCGovernor.auditPlan(deletionPlan, {
      allowDestroy: true,
    });
    assert.equal(allowedReport.status, "PASS");
    assert.equal(allowedReport.allowed, true);
    assert.equal(allowedReport.totalViolations, 0);
  });

  // -------------------------------------------------------------------------
  // BDD-1436: End-to-End Cryptographic Receipt Generation
  // -------------------------------------------------------------------------
  it("BDD-1436: generates SHA-256 verifiable audit receipt in docs/evidence/TERRAFORM_RECEIPT.json", () => {
    const compliantPlan = {
      resource_changes: [
        {
          address: "aws_ebs_volume.secure_vol",
          type: "aws_ebs_volume",
          change: {
            actions: ["create"],
            after: {
              size: 20,
              encrypted: true,
            },
          },
        },
      ],
    };

    const receiptFile = path.join(ROOT, "docs", "evidence", "TERRAFORM_RECEIPT.json");
    const report = EosTerraformIaCGovernor.auditPlan(compliantPlan, {
      receiptPath: receiptFile,
    });

    assert.equal(report.status, "PASS");
    assert.ok(fs.existsSync(receiptFile), "Expected receipt file to be created");

    const receiptContent = JSON.parse(fs.readFileSync(receiptFile, "utf8"));
    assert.equal(receiptContent.status, "PASS");
    assert.equal(receiptContent.sha256Receipt, report.sha256Receipt);
    assert.equal(typeof receiptContent.timestampIso, "string");
  });

  // -------------------------------------------------------------------------
  // Native AST Fallback Parity Check
  // -------------------------------------------------------------------------
  it("verifies native AST fallback engine parity with OPA evaluation", () => {
    const mixedPlan = {
      resource_changes: [
        {
          address: "aws_security_group.ingress_bad",
          type: "aws_security_group",
          change: {
            actions: ["create"],
            after: {
              ingress: [{ from_port: 22, to_port: 22, cidr_blocks: ["0.0.0.0/0"] }],
            },
          },
        },
        {
          address: "aws_db_instance.db_drop",
          type: "aws_db_instance",
          change: {
            actions: ["delete"],
          },
        },
      ],
    };

    const nativeReport = EosTerraformIaCGovernor.auditPlan(mixedPlan, {
      forceNativeFallback: true,
      allowDestroy: false,
    });

    assert.equal(nativeReport.allowed, false);
    assert.equal(nativeReport.executionEngine, "NATIVE_AST_FALLBACK");
    assert.ok(nativeReport.violations.length >= 1);
    assert.equal(nativeReport.status, "DESTRUCTION_REJECTED");
  });
});
