/**
 * Portable fleet registry snapshot. This module reports configured metadata;
 * it does not probe repositories, hooks, CI, or production endpoints.
 */

export interface FleetProjectManifest {
  readonly id: string;
  readonly name: string;
  readonly localPathEnv: string;
  readonly remoteUrl: string;
  readonly productionUrl: string;
  readonly type: string;
  readonly status: "REGISTERED" | "UNREGISTERED";
  readonly authorization: "LEVEL_3_PRODUCTION_AUTHORIZED" | "LEVEL_2_AUTHORIZED";
}

export interface FleetProjectStatusReport {
  readonly id: string;
  readonly name: string;
  readonly registryStatus: "REGISTERED";
  readonly repositoryStatus: "NOT_PROBED";
  readonly hooksStatus: "NOT_PROBED";
  readonly productionHealth: "NOT_PROBED";
  readonly epistemicState: "NEEDS_AUDIT";
}

export interface FleetDispatchResult {
  readonly dispatchId: string;
  readonly version: "10.1.0-portable-fleet-registry";
  readonly timestamp: string;
  readonly projectsRegistered: number;
  readonly checksRun: false;
  readonly reports: readonly FleetProjectStatusReport[];
}

export const CANONICAL_FLEET_PROJECTS: readonly FleetProjectManifest[] = [
  {
    id: "eos-system",
    name: "EOS System (Control Plane Core)",
    localPathEnv: "EOS_FLEET_EOS_SYSTEM_PATH",
    remoteUrl: "https://github.com/valentinflorezarbelaez-ai/Eos-System.git",
    productionUrl: "https://eos-system-ten.vercel.app",
    type: "control-plane-monolith",
    status: "REGISTERED",
    authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
  },
  {
    id: "aberamentho",
    name: "Aberamentho Pleroma Music",
    localPathEnv: "EOS_FLEET_ABERAMENTHO_PATH",
    remoteUrl: "https://github.com/valentinflorezarbelaez-ai/Aberamentho-s-Pleroma-music.git",
    productionUrl: "https://aberamentosprelomamusic.vercel.app",
    type: "sacred-acoustic-app",
    status: "REGISTERED",
    authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
  },
  {
    id: "portafolio",
    name: "Portafolio Oficial — Valentín Flórez",
    localPathEnv: "EOS_FLEET_PORTAFOLIO_PATH",
    remoteUrl: "https://github.com/valentinflorezarbelaez-ai/portafolio.git",
    productionUrl: "https://portafolio-valentin.vercel.app",
    type: "executive-showcase",
    status: "REGISTERED",
    authorization: "LEVEL_3_PRODUCTION_AUTHORIZED",
  },
  {
    id: "performance-talent-group",
    name: "PTG — Performance Talent Group",
    localPathEnv: "EOS_FLEET_PTG_PATH",
    remoteUrl: "https://github.com/valentinflorezarbelaez-ai/Performance-Talent-Group.git",
    productionUrl: "https://ptg-performance-talent-group.vercel.app",
    type: "enterprise-operations",
    status: "REGISTERED",
    authorization: "LEVEL_2_AUTHORIZED",
  },
] as const;

export function evaluateFleetStatusSnapshot(): FleetDispatchResult {
  const reports: FleetProjectStatusReport[] = CANONICAL_FLEET_PROJECTS.map((project) => ({
    id: project.id,
    name: project.name,
    registryStatus: "REGISTERED",
    repositoryStatus: "NOT_PROBED",
    hooksStatus: "NOT_PROBED",
    productionHealth: "NOT_PROBED",
    epistemicState: "NEEDS_AUDIT",
  }));

  return {
    dispatchId: "FLEET-REGISTRY-SNAPSHOT",
    version: "10.1.0-portable-fleet-registry",
    timestamp: new Date().toISOString(),
    projectsRegistered: CANONICAL_FLEET_PROJECTS.length,
    checksRun: false,
    reports,
  };
}
