/**
 * Educational catalog for the Linux concept page.
 *
 * This repository is not an operating-system kernel. The VFS-shaped paths
 * below are string fixtures, not mounted files, and EosRcuCell is a
 * single-threaded JavaScript snapshot example rather than a Linux RCU
 * implementation.
 */

export interface LinuxKernelPillar {
  readonly id: string;
  readonly subsystem: string;
  readonly linuxKernelMechanism: string;
  readonly eosRing0Implementation: string;
  readonly samaelianAnatomy: string;
  readonly performanceMetric: string;
}

export type EosVfsPath =
  | "/proc/eos/version"
  | "/proc/eos/rcu_stats"
  | "/proc/eos/eevdf_sched"
  | "/sys/kernel/ebpf_verifier"
  | "/dev/anubis_law_gate";

const NOT_IMPLEMENTED = "No existe una implementación Ring-0 en este repositorio; la página solo muestra referencias y fixtures.";
const NOT_MEASURED = "Sin métrica de rendimiento medida por EOS.";

export const LINUX_KERNEL_7_PILLARS: readonly LinuxKernelPillar[] = [
  {
    id: "rcu-lockless",
    subsystem: "RCU (Read-Copy-Update)",
    linuxKernelMechanism: "Linux RCU permite lectores concurrentes y difiere la recuperación de memoria hasta después de un periodo de gracia.",
    eosRing0Implementation: "La clase EosRcuCell es un ejemplo síncrono de reemplazo de snapshots inmutables; no implementa RCU ni concurrencia de kernel.",
    samaelianAnatomy: "Metáfora explicativa de la página.",
    performanceMetric: NOT_MEASURED
  },
  {
    id: "ebpf-static-verifier",
    subsystem: "eBPF y XDP",
    linuxKernelMechanism: "Linux valida programas eBPF antes de permitir su ejecución en el kernel.",
    eosRing0Implementation: NOT_IMPLEMENTED,
    samaelianAnatomy: "Metáfora explicativa de la página.",
    performanceMetric: NOT_MEASURED
  },
  {
    id: "eevdf-preempt-rt",
    subsystem: "EEVDF y PREEMPT_RT",
    linuxKernelMechanism: "EEVDF elige tareas elegibles según fechas límite virtuales; PREEMPT_RT cambia la preempción de Linux para requisitos de tiempo real.",
    eosRing0Implementation: NOT_IMPLEMENTED,
    samaelianAnatomy: "Metáfora explicativa de la página.",
    performanceMetric: NOT_MEASURED
  },
  {
    id: "slub-kmem-cache",
    subsystem: "SLUB y kmem_cache",
    linuxKernelMechanism: "SLUB gestiona cachés de objetos del kernel Linux.",
    eosRing0Implementation: NOT_IMPLEMENTED,
    samaelianAnatomy: "Metáfora explicativa de la página.",
    performanceMetric: NOT_MEASURED
  },
  {
    id: "vfs-everything-is-a-file",
    subsystem: "VFS (/proc, /sys, /dev)",
    linuxKernelMechanism: "La VFS de Linux presenta una interfaz común para operaciones sobre sistemas de archivos.",
    eosRing0Implementation: "Las rutas /proc/eos/*, /sys/kernel/* y /dev/anubis_law_gate son claves de un mapa de fixtures; no son nodos del sistema.",
    samaelianAnatomy: "Metáfora explicativa de la página.",
    performanceMetric: NOT_MEASURED
  },
  {
    id: "cgroups-namespaces-seccomp",
    subsystem: "cgroups v2, namespaces y seccomp",
    linuxKernelMechanism: "Linux usa estas interfaces para límites de recursos, aislamiento de vistas y filtrado de llamadas al sistema.",
    eosRing0Implementation: "El comando de sandbox de EOS puede delegar aislamiento a Docker Linux cuando está disponible; esta página web no crea esos controles.",
    samaelianAnatomy: "Metáfora explicativa de la página.",
    performanceMetric: NOT_MEASURED
  },
  {
    id: "linus-good-taste-abi",
    subsystem: "Diseño de estructuras y compatibilidad ABI",
    linuxKernelMechanism: "Un diseño cuidadoso puede reducir casos especiales; preservar ABI requiere contratos y pruebas de compatibilidad.",
    eosRing0Implementation: "La página contiene un ejemplo textual; EOS no audita ABI de kernel ni de los proyectos registrados.",
    samaelianAnatomy: "Metáfora explicativa de la página.",
    performanceMetric: NOT_MEASURED
  }
] as const;

export const EOS_VFS_PROC_NODES: Record<EosVfsPath, string> = {
  "/proc/eos/version": "Concepto: versión de kernel Linux. Fixture informativo; EOS no incluye un kernel Linux ni una ABI de usuario propia.",
  "/proc/eos/rcu_stats": "Concepto: Read-Copy-Update (RCU). Fixture informativo; no se mide concurrencia ni se ejecuta una implementación RCU.",
  "/proc/eos/eevdf_sched": "Concepto: EEVDF. Fixture informativo; no se programan tareas ni se ofrecen garantías de tiempo real.",
  "/sys/kernel/ebpf_verifier": "Concepto: verificador eBPF. Fixture informativo; no se analiza bytecode, prueba seguridad ni ejecuta JIT.",
  "/dev/anubis_law_gate": "Concepto: dispositivo de caracteres. Fixture informativo; /dev/anubis_law_gate no existe en este sistema."
};

/**
 * Synchronous immutable-snapshot example retained for compatibility with the
 * earlier educational API. It is not thread-safe Linux RCU and makes no
 * lock-free, atomicity, allocation, or latency guarantees.
 */
export class EosRcuCell<T extends object> {
  private currentPtr: Readonly<T>;
  private generation = 1;

  constructor(initialState: T) {
    this.currentPtr = Object.freeze({ ...initialState });
  }

  /** Return the currently stored shallow-frozen snapshot. */
  public rcuReadDereference(): Readonly<T> {
    return this.currentPtr;
  }

  /** Replace the snapshot synchronously; this does not provide RCU semantics. */
  public rcuAssignPointer(mutator: (prev: Readonly<T>) => T): {
    snapshot: Readonly<T>;
    generation: number;
  } {
    const nextCopy = Object.freeze(mutator(this.currentPtr));
    this.currentPtr = nextCopy;
    this.generation += 1;
    return { snapshot: this.currentPtr, generation: this.generation };
  }
}
