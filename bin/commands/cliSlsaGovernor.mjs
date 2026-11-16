/**
 * CLI SLSA Level 3/4 Provenance & Cryptographic SBOM Handlers
 *
 * Implements toolchain:slsa:* subcommands for CycloneDX / SPDX SBOM generation,
 * In-toto SLSA v1.0 attestations, DSSE Ed25519 signing/verification, and audit receipt emission.
 *
 * Conforms to SPEC-293 / CHANGE-155.
 */

import {
  EosDsseSigner,
  EosSbomGenerator,
  EosSlsaAttestor,
  auditProvenancePipeline,
  evaluateSlsaLevel,
} from "../../src/core/eosSlsaProvenanceGovernor.ts";

const HANDLERS = {};

async function cmd_slsa_sbom(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const isSpdx = args.includes("--spdx") || args.includes("spdx");

  const components = EosSbomGenerator.scanDirectoryFiles(process.cwd(), [".ts", ".js", ".mjs", ".json"]);

  if (isSpdx) {
    const spdxDoc = EosSbomGenerator.generateSpdx(components);
    if (isJson) {
      console.log(JSON.stringify(spdxDoc, null, 2));
      return;
    }
    console.log("\n===============================================================");
    console.log(" 📜  EOS SPDX 2.3 SOFTWARE BILL OF MATERIALS (SPEC-293)        ");
    console.log("===============================================================");
    console.log(`  Document Name       : ${spdxDoc.name}`);
    console.log(`  SPDX Version        : ${spdxDoc.spdxVersion}`);
    console.log(`  Data License        : ${spdxDoc.dataLicense}`);
    console.log(`  Total Packages      : ${spdxDoc.packages.length}`);
    console.log(`  Document Namespace  : ${spdxDoc.documentNamespace}`);
    console.log("===============================================================\n");
  } else {
    const cdxDoc = EosSbomGenerator.generateCycloneDx(components);
    if (isJson) {
      console.log(JSON.stringify(cdxDoc, null, 2));
      return;
    }
    console.log("\n===============================================================");
    console.log(" 📦  EOS CYCLONEDX v1.5 SBOM GENERATOR (SPEC-293)              ");
    console.log("===============================================================");
    console.log(`  BOM Format          : ${cdxDoc.bomFormat} ${cdxDoc.specVersion}`);
    console.log(`  Serial Number       : ${cdxDoc.serialNumber}`);
    console.log(`  Root Component      : ${cdxDoc.metadata.component.name}@${cdxDoc.metadata.component.version}`);
    console.log(`  Components Cataloged: ${cdxDoc.components.length}`);
    console.log(`  Timestamp           : ${cdxDoc.metadata.timestamp}`);
    console.log("===============================================================\n");
  }
}

async function cmd_slsa_attest(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const components = EosSbomGenerator.scanDirectoryFiles(process.cwd(), [".ts", ".json"]);
  const subjects = components.slice(0, 3).map((c) => ({
    name: c.name,
    digest: { sha256: c.sha256 },
  }));

  const statement = EosSlsaAttestor.buildProvenanceStatement({
    subjects,
    externalParameters: {
      sourceRepo: "https://github.com/valentinflorezarbelaez-ai/Glorian-System",
      commitHash: "HEAD",
    },
    internalParameters: {
      isolatedEnvironment: true,
      lawVPurityEnforced: true,
    },
  });

  const { publicKey, privateKey, keyid } = EosDsseSigner.generateKeyPair();
  const envelope = EosDsseSigner.signStatement(statement, privateKey, keyid);
  const evalResult = evaluateSlsaLevel(statement, envelope);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          statement,
          envelope,
          evaluation: evalResult,
          publicKey,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🛡️  EOS SLSA v1.0 IN-TOTO ATTESTATION & DSSE SIGNER (SPEC-293) ");
  console.log("===============================================================");
  console.log(`  In-Toto Type        : ${statement._type}`);
  console.log(`  Predicate Type      : ${statement.predicateType}`);
  console.log(`  Attested Subjects   : ${statement.subject.length}`);
  console.log(`  DSSE Key ID         : ${keyid}`);
  console.log(`  Payload Type        : ${envelope.payloadType}`);
  console.log(`  SLSA Level Achieved : ${evalResult.slsaLevel}`);
  console.log(`  Compliance Status   : ${evalResult.isCompliant ? "COMPLIANT" : "NON_COMPLIANT"}`);
  console.log("===============================================================\n");
}

async function cmd_slsa_verify(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = auditProvenancePipeline(process.cwd());

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log("\n===============================================================");
  console.log(" 🔒  EOS SLSA PROVENANCE AUDIT & VERIFICATION (SPEC-293)       ");
  console.log("===============================================================");
  console.log(`  Specification       : ${receipt.specRef}`);
  console.log(`  Artifacts Attested  : ${receipt.totalArtifactsAttested}`);
  console.log(`  SBOM Components     : ${receipt.sbomComponentsCount}`);
  console.log(`  SLSA Level Achieved : ${receipt.slsaLevelAchieved}`);
  console.log(`  DSSE Signature Valid: ${receipt.envelopeSignatureValid}`);
  console.log(`  SHA-256 Receipt Seal: ${receipt.sha256Signature}`);
  console.log("===============================================================\n");
}

HANDLERS["toolchain:slsa:sbom"] = cmd_slsa_sbom;
HANDLERS["toolchain:slsa:attest"] = cmd_slsa_attest;
HANDLERS["toolchain:slsa:verify"] = cmd_slsa_verify;

export async function handleSlsaCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}
