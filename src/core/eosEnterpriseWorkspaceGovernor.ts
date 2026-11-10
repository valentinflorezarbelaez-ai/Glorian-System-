/**
 * EOS SYSTEM — ENTERPRISE MULTI-PROJECT WORKSPACE GOVERNOR & POLYGLOT TOPOLOGY ENGINE (Layer 0)
 * Governed by SPEC-046, CHANGE-039, ADR-052 (v52.0.0)
 */

import fs from "node:fs";
import path from "node:path";
import { assertPrecondition, assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import { EosDurableSqliteLedger } from "./eosDurableSqliteLedger.ts";
import { EosAntigravityDirector } from "./eosAntigravityDirector.ts";

export type {
  WorkspaceOrchestrator,
  EnterpriseLanguage,
  WorkspaceArchitecturalRole,
  ContractStandard,
  WorkspaceAccessMode,
  WorkspaceMember,
  ContractArtifact,
  SecretFinding,
  SupplyChainPosture,
  EnterpriseVerificationCommand,
  EnterpriseWorkspaceTopology,
  InspectWorkspaceOptions,
  RegisteredFleetWorkspace,
  OnboardWorkspaceInput,
  OnboardGeneratedArtifact,
  OnboardWorkspaceResult,
  AuthorizedWorkspaceResolution,
  StructuralGateResult,
  EnterpriseWorkspaceVerificationReport,
} from "./eosEnterpriseWorkspaceGovernor.types.ts";

import {
  IGNORED_SCAN_DIRS,
  BINARY_EXTENSIONS,
  CREDENTIAL_PATTERNS,
  DETERMINISTIC_LOCKFILE_NAMES,
  inspectContractFile,
  inspectWorkspaceMemberManifest,
  synthesizeWorkspaceVerificationCommands,
  buildOnboardIntakeMarkdown,
  buildOnboardSpecMarkdown,
  type WorkspaceOrchestrator,
  type EnterpriseLanguage,
  type WorkspaceMember,
  type ContractArtifact,
  type SecretFinding,
  type SupplyChainPosture,
  type EnterpriseVerificationCommand,
  type EnterpriseWorkspaceTopology,
  type InspectWorkspaceOptions,
  type RegisteredFleetWorkspace,
  type OnboardWorkspaceInput,
  type OnboardGeneratedArtifact,
  type OnboardWorkspaceResult,
  type AuthorizedWorkspaceResolution,
  type StructuralGateResult,
  type EnterpriseWorkspaceVerificationReport,
  type WorkspaceAccessMode,
} from "./eosEnterpriseWorkspaceGovernor.types.ts";

function toPosixRelative(rootDir: string, targetPath: string): string {
  const rel = path.relative(rootDir, targetPath).replace(/\\/g, "/");
  return rel === "" ? "." : rel;
}

function isPathWithin(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function sanitizeProjectId(rawId: string): string {
  const normalized = rawId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  assertPrecondition(
    normalized.length >= 2 && normalized.length <= 64,
    "projectId must contain 2..64 alphanumeric/hyphen characters",
  );
  return normalized;
}

function defaultEnvVarForProject(projectId: string): string {
  return `EOS_FLEET_${projectId.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase()}_PATH`;
}

function safeReadUtf8(filePath: string, maxBytes: number = 256 * 1024): string | null {
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function scanWorkspaceTree(
  rootDir: string,
  maxDepth: number,
  maxFiles: number,
): { files: readonly string[]; skippedSymlinkCount: number } {
  const collected: string[] = [];
  let skippedSymlinkCount = 0;

  const visit = (currentDir: string, depth: number): void => {
    if (depth > maxDepth || collected.length >= maxFiles) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (collected.length >= maxFiles) break;
      if (IGNORED_SCAN_DIRS.has(entry.name) || entry.name.startsWith(".worktree")) continue;
      const fullPath = path.join(currentDir, entry.name);
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) {
        skippedSymlinkCount += 1;
        continue;
      }
      if (stat.isDirectory()) visit(fullPath, depth + 1);
      else if (stat.isFile()) collected.push(fullPath);
    }
  };

  visit(rootDir, 0);
  return { files: collected, skippedSymlinkCount };
}

export class EosEnterpriseWorkspaceGovernor {
  public static inspectWorkspace(targetPath: string, options?: InspectWorkspaceOptions): EnterpriseWorkspaceTopology {
    assertPrecondition(
      typeof targetPath === "string" && targetPath.trim().length > 0,
      "targetPath must be a non-empty string",
    );

    const candidateRoot = path.resolve(targetPath.trim());
    assertPrecondition(fs.existsSync(candidateRoot), `Workspace path does not exist: ${candidateRoot}`);
    const rootLstat = fs.lstatSync(candidateRoot);
    assertPrecondition(!rootLstat.isSymbolicLink(), "Symbolic-link workspace roots are rejected");
    assertPrecondition(rootLstat.isDirectory(), `Workspace path is not a directory: ${candidateRoot}`);

    const realRoot = fs.realpathSync(candidateRoot);
    const maxDepth = Math.min(Math.max(options?.maxDepth ?? 6, 1), 8);
    const maxFiles = Math.min(Math.max(options?.maxFiles ?? 4000, 50), 10000);

    const { files, skippedSymlinkCount } = scanWorkspaceTree(realRoot, maxDepth, maxFiles);
    const relSet = new Set<string>(files.map((f) => toPosixRelative(realRoot, f)));

    const orchestrators: WorkspaceOrchestrator[] = [];
    if (relSet.has("turbo.json")) orchestrators.push("turborepo");
    if (relSet.has("nx.json")) orchestrators.push("nx");
    if (relSet.has("pnpm-workspace.yaml")) orchestrators.push("pnpm_workspaces");

    const rootPkgText = safeReadUtf8(path.join(realRoot, "package.json"));
    if (rootPkgText) {
      try {
        const parsed = JSON.parse(rootPkgText);
        if (parsed && parsed.workspaces) orchestrators.push("npm_workspaces");
      } catch {}
    }

    const rootCargoText = safeReadUtf8(path.join(realRoot, "Cargo.toml"));
    if (rootCargoText && /\[workspace\]/.test(rootCargoText)) orchestrators.push("cargo_workspace");
    if (relSet.has("go.work")) orchestrators.push("go_workspace");
    const rootPyproject = safeReadUtf8(path.join(realRoot, "pyproject.toml"));
    if (rootPyproject && /\[(?:tool\.uv|tool\.poetry|project)\]/.test(rootPyproject))
      orchestrators.push("python_uv_poetry");
    if (relSet.has("MODULE.bazel") || relSet.has("WORKSPACE") || relSet.has("WORKSPACE.bazel"))
      orchestrators.push("bazel");
    if (relSet.has("settings.gradle") || relSet.has("settings.gradle.kts")) orchestrators.push("gradle_multi");
    if (relSet.has("melos.yaml")) orchestrators.push("melos_flutter");
    if (orchestrators.length === 0) orchestrators.push("single_package");

    const languageSet = new Set<EnterpriseLanguage>();
    const members: WorkspaceMember[] = [];
    const contracts: ContractArtifact[] = [];
    const lockfiles: string[] = [];
    const containerManifests: string[] = [];
    const iacManifests: string[] = [];
    const ciWorkflows: string[] = [];
    const secretFindings: SecretFinding[] = [];
    let hasExternalPackageDependencies = false;

    for (const fullFile of files) {
      const relPath = toPosixRelative(realRoot, fullFile);
      const baseName = path.basename(fullFile);
      const lowerBase = baseName.toLowerCase();
      const ext = path.extname(fullFile).toLowerCase();
      const relDir = path.posix.dirname(relPath);

      if (ext === ".ts" || ext === ".tsx") languageSet.add("typescript");
      else if (ext === ".js" || ext === ".mjs" || ext === ".cjs" || ext === ".jsx") languageSet.add("javascript");
      else if (ext === ".go") languageSet.add("go");
      else if (ext === ".rs") languageSet.add("rust");
      else if (ext === ".py") languageSet.add("python");
      else if (ext === ".dart") languageSet.add("flutter_dart");
      else if (ext === ".java" || ext === ".kt") languageSet.add("java_kotlin");
      else if (ext === ".c" || ext === ".cc" || ext === ".cpp" || ext === ".h" || ext === ".hpp")
        languageSet.add("cpp_c");
      else if (ext === ".cs") languageSet.add("csharp");
      else if (ext === ".sql") languageSet.add("sql");
      else if (ext === ".tla") languageSet.add("tla_plus");

      if (DETERMINISTIC_LOCKFILE_NAMES.has(baseName)) lockfiles.push(relPath);

      if (
        lowerBase === "dockerfile" ||
        lowerBase.startsWith("dockerfile.") ||
        lowerBase === "containerfile" ||
        /^docker-compose.*\.(?:yml|yaml)$/.test(lowerBase)
      ) {
        containerManifests.push(relPath);
      }
      if (
        ext === ".tf" ||
        lowerBase === "chart.yaml" ||
        lowerBase === "vercel.json" ||
        lowerBase === "fly.toml" ||
        lowerBase === "railway.json" ||
        /(?:^|\/)(?:k8s|kubernetes|helm)\/.*\.(?:yml|yaml)$/.test(relPath.toLowerCase())
      ) {
        iacManifests.push(relPath);
      }
      if (
        /^\.github\/workflows\/.*\.(?:yml|yaml)$/.test(relPath) ||
        lowerBase === ".gitlab-ci.yml" ||
        relPath === ".circleci/config.yml" ||
        lowerBase === "jenkinsfile" ||
        lowerBase === "azure-pipelines.yml"
      ) {
        ciWorkflows.push(relPath);
      }

      const manifestRes = inspectWorkspaceMemberManifest({
        baseName,
        relPath,
        relDir,
        defaultName: path.basename(realRoot),
        relSet,
        readContent: () => safeReadUtf8(fullFile) || "",
      });
      if (manifestRes.hasExternalDeps) hasExternalPackageDependencies = true;
      if (manifestRes.member) {
        languageSet.add(manifestRes.member.language);
        members.push(manifestRes.member);
      }

      let statSize = 0;
      try {
        statSize = fs.lstatSync(fullFile).size;
      } catch {}

      const contract = inspectContractFile({
        lowerBase,
        ext,
        relPath,
        statSize,
        readContent: () => safeReadUtf8(fullFile) || "",
      });
      if (contract) contracts.push(contract);

      if (!BINARY_EXTENSIONS.has(ext)) {
        const text = safeReadUtf8(fullFile, 512 * 1024);
        if (text !== null) {
          for (const pat of CREDENTIAL_PATTERNS) {
            if (pat.regex.test(text)) secretFindings.push({ patternName: pat.name, relativePath: relPath });
          }
        }
      }
    }

    const languages = Array.from(languageSet).sort();
    const hasMultiOrchestrator = orchestrators.some((o) => o !== "single_package");
    const archetype: EnterpriseWorkspaceTopology["archetype"] =
      (hasMultiOrchestrator || members.length > 1) && languages.length > 1
        ? "POLYGLOT_MONOREPO"
        : hasMultiOrchestrator || members.length > 1
          ? "SINGLE_LANGUAGE_MONOREPO"
          : files.length >= 10
            ? "ENTERPRISE_SERVICE"
            : "MINIMAL_REPOSITORY";

    const supplyChain: SupplyChainPosture = {
      lockfiles,
      hasDeterministicLockfile: lockfiles.length > 0 || !hasExternalPackageDependencies,
      containerManifests,
      iacManifests,
      ciWorkflows,
      secretHygieneClean: secretFindings.length === 0,
      secretFindings,
    };

    const recommendedVerificationCommands = synthesizeWorkspaceVerificationCommands(
      safeReadUtf8(path.join(realRoot, "package.json")),
      relSet,
      languages,
      orchestrators,
    );

    let signalPoints = 0;
    if (members.length > 0) signalPoints += 20;
    if (contracts.length > 0 && contracts.every((c) => c.validSyntax)) signalPoints += 20;
    else if (contracts.length > 0) signalPoints += 8;
    if (supplyChain.hasDeterministicLockfile) signalPoints += 20;
    if (supplyChain.secretHygieneClean) signalPoints += 25;
    if (
      supplyChain.ciWorkflows.length > 0 ||
      supplyChain.containerManifests.length > 0 ||
      supplyChain.iacManifests.length > 0
    ) {
      signalPoints += 15;
    }

    const workspaceName = path.basename(realRoot);
    const sha256TopologyReceipt = pureSha256(
      JSON.stringify({
        workspaceName,
        archetype,
        orchestrators,
        languages,
        members: members.map((m) => `${m.manifestPath}:${m.language}:${m.architecturalRole}`),
        contracts: contracts.map((c) => `${c.standard}:${c.relativePath}:${c.validSyntax}`),
        lockfiles,
        secretHygieneClean: supplyChain.secretHygieneClean,
        scannedFileCount: files.length,
      }),
    );
    assertPostcondition(sha256TopologyReceipt.length === 64, "Topology receipt must be 64-char SHA-256 hex");

    return deepFreeze({
      workspaceName,
      workspaceRoot: realRoot,
      archetype,
      orchestrators,
      languages,
      members,
      contracts,
      supplyChain,
      recommendedVerificationCommands,
      scannedFileCount: files.length,
      skippedSymlinkCount,
      enterpriseReadinessSignalsScore: Math.min(100, signalPoints),
      scoreDisclaimer:
        "Bounded local structural signal count (0..100); does not certify runtime reliability, full SAST, or production readiness.",
      sha256TopologyReceipt,
      timestamp: new Date().toISOString(),
    });
  }

  public static listRegisteredWorkspaces(
    controlPlaneRoot: string = process.cwd(),
  ): readonly RegisteredFleetWorkspace[] {
    const resolvedControlPlane = fs.realpathSync(path.resolve(controlPlaneRoot));
    const registryPath = path.join(resolvedControlPlane, "docs", "projects", "registry.json");
    if (!fs.existsSync(registryPath)) return deepFreeze([]);

    const raw = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    const entries = Array.isArray(raw?.projects) ? raw.projects : [];
    const synthesizedFleetEnv = EosAntigravityDirector.synthesizeAntigravityMcpEntry(resolvedControlPlane).env;
    const results: RegisteredFleetWorkspace[] = [];

    for (const p of entries) {
      const id = String(p.id || "");
      const envName = typeof p.localPathEnv === "string" ? p.localPathEnv : undefined;
      const envVal = envName ? process.env[envName] || synthesizedFleetEnv[envName] : undefined;
      const candidatePath =
        id === "eos-system"
          ? resolvedControlPlane
          : typeof envVal === "string" && envVal.trim().length > 0
            ? path.resolve(envVal.trim())
            : typeof p.localPath === "string" && p.localPath.trim().length > 0
              ? path.resolve(p.localPath.trim())
              : null;

      let pathExistsOnDisk = false;
      let resolvedLocalPath: string | null = candidatePath;
      if (candidatePath && fs.existsSync(candidatePath)) {
        try {
          const lst = fs.lstatSync(candidatePath);
          if (lst.isDirectory() && !lst.isSymbolicLink()) {
            resolvedLocalPath = fs.realpathSync(candidatePath);
            pathExistsOnDisk = true;
          }
        } catch {
          pathExistsOnDisk = false;
        }
      }

      const missing: string[] = [];
      if (p.status !== "REGISTERED") missing.push("REGISTERED");
      if (p.intake !== "INTAKE_COMPLETE") missing.push("INTAKE_COMPLETE");
      if (p.specification !== "SPECIFICATION_APPROVED") missing.push("SPECIFICATION_APPROVED");
      if (p.audit !== "AUDIT_COMPLETE") missing.push("AUDIT_COMPLETE");
      const auth = String(p.authorization || "NONE");
      const hasLevel2Plus = /^LEVEL_[23]/.test(auth);
      if (p.ownerApproval !== "OWNER_APPROVAL" && !hasLevel2Plus) missing.push("OWNER_APPROVAL");
      if (!hasLevel2Plus) missing.push("IMPLEMENTATION_AUTHORIZED_LEVEL_2_PLUS");

      results.push({
        id,
        name: String(p.name || id),
        localPathEnv: envName,
        localPath: typeof p.localPath === "string" ? p.localPath : undefined,
        resolvedLocalPath,
        pathExistsOnDisk,
        remoteUrl: String(p.remoteUrl || "NOT_DECLARED"),
        productionUrl: typeof p.productionUrl === "string" ? p.productionUrl : undefined,
        type: String(p.type || "enterprise-workspace"),
        status: String(p.status || "UNREGISTERED"),
        intake: String(p.intake || "MISSING"),
        specification: String(p.specification || "MISSING"),
        audit: String(p.audit || "MISSING"),
        ownerApproval: typeof p.ownerApproval === "string" ? p.ownerApproval : undefined,
        authorization: auth,
        writeAuthorizedUnderLawIV: missing.length === 0,
        missingLawIVPreconditions: missing,
      });
    }

    return deepFreeze(results);
  }

  public static resolveAuthorizedWorkspace(
    projectId: string,
    relativeSubPath: string = ".",
    accessMode: WorkspaceAccessMode = "READ_ONLY",
    controlPlaneRoot: string = process.cwd(),
  ): AuthorizedWorkspaceResolution {
    const cleanId = sanitizeProjectId(projectId);
    const fleet = this.listRegisteredWorkspaces(controlPlaneRoot);
    const matched = fleet.find((w) => w.id.toLowerCase() === cleanId);

    if (!matched) {
      throw new Error(
        `[UNREGISTERED_WORKSPACE] Project '${cleanId}' is not registered in docs/projects/registry.json.`,
      );
    }
    if (!matched.resolvedLocalPath || !matched.pathExistsOnDisk) {
      throw new Error(
        `[WORKSPACE_PATH_UNAVAILABLE] Registered project '${cleanId}' local path is not present on disk (check ${matched.localPathEnv || "localPath"}).`,
      );
    }
    if (accessMode === "WRITE_GATED" && !matched.writeAuthorizedUnderLawIV) {
      throw new Error(
        `[LAW_IV_WRITE_BARRIER_BLOCKED] External writes to '${cleanId}' are prohibited; missing preconditions: ${matched.missingLawIVPreconditions.join(", ")}.`,
      );
    }

    const workspaceRoot = matched.resolvedLocalPath;
    const sub = relativeSubPath && relativeSubPath.trim().length > 0 ? relativeSubPath.trim() : ".";
    const candidate = path.resolve(workspaceRoot, sub);
    if (!isPathWithin(workspaceRoot, candidate)) {
      throw new Error(
        `[BOUNDARY_ESCAPE_BLOCKED] Requested subpath '${sub}' escapes registered workspace '${cleanId}'.`,
      );
    }
    if (fs.existsSync(candidate)) {
      const lst = fs.lstatSync(candidate);
      if (lst.isSymbolicLink()) {
        throw new Error("[SYMLINK_REJECTED] Symbolic-link targets inside registered workspaces are rejected.");
      }
      const realCandidate = fs.realpathSync(candidate);
      if (!isPathWithin(workspaceRoot, realCandidate)) {
        throw new Error(`[BOUNDARY_ESCAPE_BLOCKED] Resolved realpath escapes registered workspace '${cleanId}'.`);
      }
    }

    return deepFreeze({
      projectId: matched.id,
      accessMode,
      workspaceRoot,
      resolvedTargetPath: candidate,
      authorizationLevel: matched.authorization,
      writeBarrierStatus: accessMode === "WRITE_GATED" ? "AUTHORIZED" : "READ_ONLY_CONFINED",
    });
  }

  public static onboardWorkspace(input: OnboardWorkspaceInput): OnboardWorkspaceResult {
    assertPrecondition(Boolean(input && typeof input.targetPath === "string"), "targetPath is required");
    const topology = this.inspectWorkspace(input.targetPath);

    const projectId = sanitizeProjectId(input.projectId || topology.workspaceName);
    const projectName = (input.projectName || topology.workspaceName).trim();
    const localPathEnv = (input.localPathEnv || defaultEnvVarForProject(projectId)).trim();
    const remoteUrl = (input.remoteUrl || "NOT_DECLARED").trim();
    const projectType = (input.projectType || topology.archetype.toLowerCase().replace(/_/g, "-")).trim();
    const dryRun = input.dryRun === true;
    const controlPlaneRoot = fs.realpathSync(path.resolve(input.controlPlaneRoot || process.cwd()));

    const intakeMd = buildOnboardIntakeMarkdown({ projectId, projectName, localPathEnv, remoteUrl, topology });
    const inventoryJson = JSON.stringify(topology, null, 2) + "\n";
    const specMd = buildOnboardSpecMarkdown(projectId, projectName);
    const auditJson =
      JSON.stringify(
        {
          projectId,
          projectName,
          auditedAt: new Date().toISOString(),
          epistemicState:
            topology.supplyChain.secretHygieneClean && topology.contracts.every((c) => c.validSyntax)
              ? "AUDIT_EXECUTED"
              : "FINDINGS_IDENTIFIED",
          secretHygieneClean: topology.supplyChain.secretHygieneClean,
          hasDeterministicLockfile: topology.supplyChain.hasDeterministicLockfile,
          contractsCount: topology.contracts.length,
          invalidContractsCount: topology.contracts.filter((c) => !c.validSyntax).length,
          enterpriseReadinessSignalsScore: topology.enterpriseReadinessSignalsScore,
          sha256TopologyReceipt: topology.sha256TopologyReceipt,
        },
        null,
        2,
      ) + "\n";

    const fileEntries = [
      { rel: `docs/intake/${projectId}/PROJECT_CONTEXT.md`, content: intakeMd },
      { rel: `docs/intake/${projectId}/inventory.json`, content: inventoryJson },
      { rel: `docs/specs/${projectId}/SPEC-001-BASELINE.md`, content: specMd },
      { rel: `docs/audits/${projectId}/AUDIT-001-BASELINE.json`, content: auditJson },
    ];

    const generatedArtifacts: OnboardGeneratedArtifact[] = fileEntries.map((entry) => ({
      relativeControlPlanePath: entry.rel,
      byteLength: Buffer.byteLength(entry.content, "utf8"),
      sha256Digest: pureSha256(entry.content),
    }));

    let registryUpdated = false;
    let ledgerEntryId: string | null = null;

    if (!dryRun) {
      for (const entry of fileEntries) {
        const dest = path.resolve(controlPlaneRoot, entry.rel);
        assertPrecondition(
          isPathWithin(controlPlaneRoot, dest),
          "Onboarding artifact destination escaped controlPlaneRoot",
        );
        if (!isPathWithin(controlPlaneRoot, topology.workspaceRoot)) {
          assertPrecondition(
            !isPathWithin(topology.workspaceRoot, dest),
            "Law IV Violation: Onboarding attempted to write inside external target repository",
          );
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, entry.content, "utf8");
      }

      const registryPath = path.join(controlPlaneRoot, "docs", "projects", "registry.json");
      assertPrecondition(isPathWithin(controlPlaneRoot, registryPath), "Registry path escaped controlPlaneRoot");
      fs.mkdirSync(path.dirname(registryPath), { recursive: true });

      const registryDoc = fs.existsSync(registryPath)
        ? JSON.parse(fs.readFileSync(registryPath, "utf8"))
        : {
            version: "10.2.0-portable-fleet-registry",
            updatedAt: new Date().toISOString(),
            masterOrchestrator: "EOS System control plane",
            complianceStandard: "EOS_CONSTITUTION_LAW_IV_EXTERNAL_WRITE_BARRIER",
            projects: [],
          };

      if (!Array.isArray(registryDoc.projects)) registryDoc.projects = [];

      const existingIdx = registryDoc.projects.findIndex(
        (p: Record<string, unknown>) => String(p.id || "").toLowerCase() === projectId,
      );

      const newEntry: Record<string, unknown> = {
        id: projectId,
        name: projectName,
        localPathEnv,
        localPath: topology.workspaceRoot,
        remoteUrl,
        ...(input.productionUrl ? { productionUrl: input.productionUrl.trim() } : {}),
        type: projectType,
        status: "REGISTERED",
        intake: "INTAKE_COMPLETE",
        specification: "SPECIFICATION_APPROVED",
        audit: "AUDIT_COMPLETE",
        authorization: "LEVEL_1_READ_ONLY_AUDIT",
        cicdGateScript: topology.recommendedVerificationCommands[0]?.command || "eos project verify",
      };

      if (existingIdx >= 0) {
        const prev = registryDoc.projects[existingIdx];
        if (typeof prev.authorization === "string" && /^LEVEL_[23]/.test(prev.authorization)) {
          newEntry.authorization = prev.authorization;
        }
        if (prev.ownerApproval === "OWNER_APPROVAL") newEntry.ownerApproval = "OWNER_APPROVAL";
        registryDoc.projects[existingIdx] = { ...prev, ...newEntry };
      } else {
        registryDoc.projects.push(newEntry);
      }

      registryDoc.updatedAt = new Date().toISOString();
      fs.writeFileSync(registryPath, JSON.stringify(registryDoc, null, 2) + "\n", "utf8");
      registryUpdated = true;

      const ledgerPath = input.ledgerDbPath || EosDurableSqliteLedger.defaultLedgerPath(controlPlaneRoot);
      const ledger = new EosDurableSqliteLedger(ledgerPath);
      try {
        const rec = ledger.appendEntry({
          category: "ARCHITECTURE_DECISION",
          projectId,
          title: `Enterprise Workspace Onboarded (${topology.archetype}) at LEVEL_1_READ_ONLY_AUDIT`,
          payload: {
            projectId,
            projectName,
            archetype: topology.archetype,
            orchestrators: topology.orchestrators,
            languages: topology.languages,
            membersCount: topology.members.length,
            contractsCount: topology.contracts.length,
            externalBytesWritten: 0,
            sha256TopologyReceipt: topology.sha256TopologyReceipt,
          },
          engramTopicKey: `eos/enterprise-onboard/${projectId}`,
        });
        ledgerEntryId = rec.entryId;
      } finally {
        ledger.close();
      }
    }

    const sha256OnboardReceipt = pureSha256(
      JSON.stringify({
        projectId,
        dryRun,
        externalBytesWritten: 0,
        topologyReceipt: topology.sha256TopologyReceipt,
        artifacts: generatedArtifacts.map((a) => `${a.relativeControlPlanePath}:${a.sha256Digest}`),
      }),
    );
    assertPostcondition(sha256OnboardReceipt.length === 64, "Onboard receipt must be 64-char SHA-256");

    return deepFreeze({
      projectId,
      projectName,
      externalTargetPath: topology.workspaceRoot,
      controlPlaneRoot,
      dryRun,
      initialAuthorization: "LEVEL_1_READ_ONLY_AUDIT",
      externalBytesWritten: 0,
      topology,
      generatedArtifacts,
      registryUpdated,
      ledgerEntryId,
      sha256OnboardReceipt,
    });
  }

  public static verifyWorkspace(
    targetPath: string,
    options?: {
      readonly controlPlaneRoot?: string;
      readonly projectId?: string;
      readonly recordLedger?: boolean;
      readonly ledgerDbPath?: string;
    },
  ): EnterpriseWorkspaceVerificationReport {
    const topology = this.inspectWorkspace(targetPath);
    const { files } = scanWorkspaceTree(topology.workspaceRoot, 5, 2500);

    const malformedJsonFiles: string[] = [];
    for (const f of files) {
      const base = path.basename(f).toLowerCase();
      if (
        base === "package.json" ||
        base === "turbo.json" ||
        base === "nx.json" ||
        base === "vercel.json" ||
        base.endsWith(".schema.json") ||
        base === "openapi.json" ||
        base === "swagger.json"
      ) {
        const text = safeReadUtf8(f, 512 * 1024);
        if (text !== null) {
          try {
            JSON.parse(text);
          } catch {
            malformedJsonFiles.push(toPosixRelative(topology.workspaceRoot, f));
          }
        }
      }
    }

    const invalidContracts = topology.contracts.filter((c) => !c.validSyntax);

    const gates: StructuralGateResult[] = [
      {
        gateId: "GATE-01-WORKSPACE-MANIFESTS",
        label: "Workspace & Package Manifest JSON Integrity",
        passed: malformedJsonFiles.length === 0,
        detail:
          malformedJsonFiles.length === 0
            ? `All inspected JSON manifests parsed cleanly (${topology.members.length} workspace member(s)).`
            : `Malformed JSON manifests detected: ${malformedJsonFiles.join(", ")}`,
      },
      {
        gateId: "GATE-02-FORMAL-CONTRACTS",
        label: "API, Schema & Formal Specification Contracts",
        passed: invalidContracts.length === 0,
        detail:
          invalidContracts.length === 0
            ? `${topology.contracts.length} formal contract(s) verified with valid syntax.`
            : `Invalid contract syntax in: ${invalidContracts.map((c) => c.relativePath).join(", ")}`,
      },
      {
        gateId: "GATE-03-SUPPLY-CHAIN-LOCKFILE",
        label: "Deterministic Supply-Chain Lockfile Posture",
        passed: topology.supplyChain.hasDeterministicLockfile,
        detail: topology.supplyChain.hasDeterministicLockfile
          ? `Deterministic lockfile posture satisfied (${topology.supplyChain.lockfiles.join(", ") || "no external package lock required"}).`
          : "Missing deterministic lockfile (e.g. package-lock.json, pnpm-lock.yaml, Cargo.lock, go.sum, uv.lock).",
      },
      {
        gateId: "GATE-04-ZERO-PLAIN-SECRETS",
        label: "Law VI Zero Plaintext Credential Scan",
        passed: topology.supplyChain.secretHygieneClean,
        detail: topology.supplyChain.secretHygieneClean
          ? `0 credential patterns matched across ${topology.scannedFileCount} workspace file(s).`
          : `Credential leak(s) detected: ${topology.supplyChain.secretFindings
              .map((s) => `${s.patternName} in ${s.relativePath}`)
              .join("; ")}`,
      },
    ];

    const overallPassed = gates.every((g) => g.passed);
    const epistemicState = overallPassed ? "VERIFIED" : "FINDINGS_IDENTIFIED";
    const sha256VerificationReceipt = pureSha256(
      JSON.stringify({
        workspaceRoot: topology.workspaceRoot,
        topologyReceipt: topology.sha256TopologyReceipt,
        gates,
      }),
    );

    let ledgerEntryId: string | null = null;
    if (options?.recordLedger !== false && (options?.controlPlaneRoot || options?.ledgerDbPath)) {
      const ledgerPath =
        options.ledgerDbPath || EosDurableSqliteLedger.defaultLedgerPath(path.resolve(options.controlPlaneRoot!));
      const ledger = new EosDurableSqliteLedger(ledgerPath);
      try {
        const rec = ledger.appendEntry({
          category: "VERIFICATION_RECEIPT",
          projectId: options.projectId || sanitizeProjectId(topology.workspaceName),
          title: `Enterprise Workspace Verification: ${epistemicState}`,
          payload: {
            workspaceName: topology.workspaceName,
            epistemicState,
            overallPassed,
            gates,
            sha256VerificationReceipt,
          },
        });
        ledgerEntryId = rec.entryId;
      } finally {
        ledger.close();
      }
    }

    return deepFreeze({
      workspaceName: topology.workspaceName,
      workspaceRoot: topology.workspaceRoot,
      epistemicState,
      overallPassed,
      gates,
      recommendedCommands: topology.recommendedVerificationCommands,
      ledgerEntryId,
      sha256VerificationReceipt,
      timestamp: new Date().toISOString(),
    });
  }
}
