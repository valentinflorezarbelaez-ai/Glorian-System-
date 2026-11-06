/**
 * Concept catalog used by the Omega page.
 *
 * This module does not implement cryptography, zero-knowledge proofs, BFT,
 * deterministic replay, E-graphs, WASI, or fleet health checks. The page uses
 * these entries as educational references; project data comes from
 * docs/projects/registry.json through /api/fleet.
 */

export interface OmegaPillarSpec {
  readonly id: string;
  readonly frontier: string;
  readonly standardOrOrigin: string;
  readonly eosTransmutation: string;
  readonly samaelianCorrespondence: string;
  readonly invariantGuarantee: string;
}

export interface TimeTravelEpoch {
  readonly tick: number;
  readonly label: string;
  readonly event: string;
  readonly subsystem: string;
}

export const OMEGA_SINGULARITY_PILLARS: readonly OmegaPillarSpec[] = [
  {
    id: "pqc-nist-fips",
    frontier: "Criptografía post-cuántica",
    standardOrOrigin: "NIST FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), FIPS 205 (SLH-DSA)",
    eosTransmutation: "La página presenta los nombres de los estándares como referencias; no ejecuta sus algoritmos.",
    samaelianCorrespondence: "Metáfora visual de la demo; no es una propiedad criptográfica.",
    invariantGuarantee: "No se generan claves, firmas ni ciphertexts."
  },
  {
    id: "zk-stark-fri",
    frontier: "Pruebas de conocimiento cero",
    standardOrOrigin: "ZK-STARK · FRI",
    eosTransmutation: "El formulario muestra una declaración textual de ejemplo.",
    samaelianCorrespondence: "Metáfora visual de la demo; no es una prueba formal.",
    invariantGuarantee: "No se genera ni verifica una prueba."
  },
  {
    id: "bft-hotstuff-quorum",
    frontier: "Tolerancia a fallas bizantinas",
    standardOrOrigin: "HotStuff · quórum 3f + 1",
    eosTransmutation: "El navegador muestra una fórmula con valores ilustrativos.",
    samaelianCorrespondence: "Metáfora visual de la demo; no representa consenso distribuido.",
    invariantGuarantee: "No hay nodos, votos, firmas ni consenso ejecutándose."
  },
  {
    id: "time-travel-dst",
    frontier: "Pruebas deterministas y reproducción de ejecuciones",
    standardOrOrigin: "Mozilla rr · FoundationDB Deterministic Simulation Testing",
    eosTransmutation: "La interfaz recorre etiquetas locales precargadas.",
    samaelianCorrespondence: "Metáfora visual de la demo; no representa un historial grabado.",
    invariantGuarantee: "No se capturan eventos ni se reproduce una ejecución."
  },
  {
    id: "egraph-superoptimizer",
    frontier: "E-Graphs y equality saturation",
    standardOrOrigin: "egg · LLVM MLIR · Souper",
    eosTransmutation: "La página describe el patrón como referencia.",
    samaelianCorrespondence: "Metáfora visual de la demo; no es una optimización ejecutada.",
    invariantGuarantee: "No se transforma ni verifica código del repositorio."
  },
  {
    id: "wasi-capability-sandbox",
    frontier: "WebAssembly System Interface y seguridad por capacidades",
    standardOrOrigin: "WebAssembly · WASI",
    eosTransmutation: "La página explica el modelo de capacidades como referencia.",
    samaelianCorrespondence: "Metáfora visual de la demo; no constituye un límite de seguridad.",
    invariantGuarantee: "No se ejecuta un módulo WASM ni se crea un sandbox WASI."
  },
  {
    id: "project-registry",
    frontier: "Registro de proyectos",
    standardOrOrigin: "docs/projects/registry.json · /api/fleet",
    eosTransmutation: "La interfaz muestra los proyectos declarados en el registro canónico.",
    samaelianCorrespondence: "La metáfora visual no indica salud ni disponibilidad.",
    invariantGuarantee: "No se sondea producción, CI, ABI o hooks."
  }
] as const;

export const TIME_TRAVEL_EPOCHS: readonly TimeTravelEpoch[] = [
  { tick: 1, label: "Inicio", event: "Inicio del recorrido", subsystem: "CLI Node.js" },
  { tick: 2, label: "Análisis", event: "Inspección local", subsystem: "Herramientas de repositorio" },
  { tick: 3, label: "Requisitos", event: "Borrador EARS", subsystem: "Generador de borradores" },
  { tick: 4, label: "Validación", event: "Validación propuesta", subsystem: "Herramientas de patch" },
  { tick: 5, label: "MCP", event: "Solicitud de herramienta", subsystem: "Servidor MCP" },
  { tick: 6, label: "Demo", event: "Fin del recorrido", subsystem: "Interfaz del navegador" }
] as const;
