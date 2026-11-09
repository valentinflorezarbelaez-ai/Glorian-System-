# SPEC-045: AUTONOMOUS EVERGREEN AUTO-UPDATER FOR GENTLE-AI & GENTLEMAN STACK (v51.0.0)

- **Status**: `SPECIFICATION_APPROVED`
- **Change Reference**: `CHANGE-038`
- **Architecture Plan**: `PLAN-038` (`ADR-051`)
- **Formal Model**: `docs/formal/GentlemanAutoUpdateEngine.tla`

---

## 1. Formal Functional Requirements (IEEE 830 / EARS)

- **FR-137 (Rate-Limit-Free Upstream SemVer & Commit Discovery)**:
  `CUANDO se invoque una verificación de actualizaciones del stack Gentleman (por tarea programada, SessionStart hook, CLI o herramienta MCP), EL SISTEMA consultará las etiquetas SemVer estables y hashes de commit remotos mediante git ls-remote sin límites de cuota API para gentle-ai, engram, gentleman-guardian-angel (gga) y agent-teams-lite, comparando determinísticamente la versión instalada contra la última versión estable upstream.`

- **FR-138 (Cryptographic Supply-Chain Verification & Windows NTFS Hot-Swap)**:
  `CUANDO exista una versión más reciente de un binario del stack (engram, gentle-ai o gga), EL SISTEMA verificará su integridad criptográfica (SHA-256 oficial en checksums.txt o compilación Go desde tag oficial con go.sum) y ejecutará un reemplazo atómico en caliente compatible con Windows NTFS (renombrando el binario en uso a .bak antes de instalar el nuevo ejecutable).`

- **FR-139 (Automatic Atomic Rollback on Health Failure)**:
  `SI la descarga, verificación SHA-256, compilación o prueba de humo post-instalación (--version / version) de cualquier componente falla, ENTONCES EL SISTEMA restaurará automáticamente el respaldo previo (.bak), abortará la mutación parcial y registrará el diagnóstico exacto en el ledger SQLite WAL.`

- **FR-140 (Secure Agent-Teams-Lite Skill Sync & EOS Constitution Preservation)**:
  `MIENTRAS se sincronicen los skills upstream de agent-teams-lite hacia .agents/skills/, EL SISTEMA escaneará todos los archivos entrantes rechazando enlaces simbólicos y patrones de secretos en texto plano, preservará intactos todos los skills soberanos con prefijo eos-* y garantizará que el hash SHA-256 de la Constitución EOS (AGENTS.md) permanezca inalterado.`

- **FR-141 (Triple-Trigger Unattended Evergreen Automation)**:
  `EL SISTEMA mantendrá actualizado el stack Gentleman de forma desatendida mediante tres disparadores coordinados con control de concurrencia (lockfile con expiración) e intervalo configurable (TTL 6 horas): (1) Tarea Programada silenciosa del sistema operativo (Windows Task Scheduler sin ventana emergente), (2) disparo oportunista desacoplado en segundo plano durante el evento SessionStart de Google Antigravity cuando el TTL haya expirado, y (3) ejecución directa vía CLI (eos gentleman update) y MCP (eos_gentleman_update).`

---

## 2. Formal Acceptance Criteria (Gherkin BDD)

```gherkin
ESCENARIO: BDD-133 — Descubrimiento SemVer exacto sin límites de tasa y comparación de versiones
  DADO un conjunto de salidas de etiquetas remotas git ls-remote con versiones como v2.9.0, v2.10.1, v3.6.0-rc1 y v3.6.0
  CUANDO EosGentlemanAutoUpdater evalúa la versión estable más reciente contra la versión local instalada
  ENTONCES ignora pre-lanzamientos (-rc, -beta, -alpha), selecciona v2.10.1 sobre v2.9.0 por orden SemVer numérico y marca UPDATE_AVAILABLE únicamente cuando upstream > installed
  Y registra el commit SHA exacto para repositorios continuos como agent-teams-lite

ESCENARIO: BDD-134 — Verificación criptográfica SHA-256 fail-closed y reemplazo en caliente con rollback automático
  DADO un archivo de actualización con manifiesto checksums.txt oficial y un binario local existente
  CUANDO el digest SHA-256 coincide y el nuevo binario pasa la sonda de versión post-instalación
  ENTONCES el binario anterior se rota de forma segura a .bak, el nuevo ejecutable queda activo y se emite recibo SHA-256
  Y SI el digest SHA-256 no coincide o el nuevo binario falla al ejecutarse, ENTONCES el sistema rechaza la actualización y restaura intacto el binario original desde .bak

ESCENARIO: BDD-135 — Sincronización segura de skills agent-teams-lite preservando skills EOS y Constitución
  DADO un árbol upstream de skills de agent-teams-lite y los skills locales eos-director, eos-sdd-pipeline, eos-fleet-ops y eos-gentleman-synergy
  CUANDO el sincronizador actualiza .agents/skills/
  ENTONCES actualiza los skills de Gentleman, bloquea cualquier archivo upstream con credenciales filtradas o enlaces simbólicos, conserva intactos todos los skills eos-*
  Y verifica que el hash SHA-256 de AGENTS.md antes y después de la actualización sea idéntico

ESCENARIO: BDD-136 — Control de concurrencia por lockfile, TTL de 6 horas y disparo oportunista en SessionStart
  DADO el estado persistente .eos/state/gentleman-auto-update.json y el hook SessionStart de Antigravity
  CUANDO el estado tiene menos de 6 horas de antigüedad
  ENTONCES el hook SessionStart omite el proceso de actualización en <15 ms sin impacto de latencia
  Y CUANDO el TTL expiró, lanza el actualizador desacoplado en segundo plano protegido por lockfile atómico y sella el recibo en EosDurableSqliteLedger

ESCENARIO: BDD-137 — Programación desatendida silenciosa en Windows Task Scheduler y actualización real en vivo
  DADO el instalador de automatización eos gentleman autoupdate:install en Windows
  CUANDO se registra la tarea programada EOS-Gentleman-Stack-AutoUpdate y se ejecuta eos gentleman update --apply
  ENTONCES la tarea queda activa cada 6 horas mediante lanzador silencioso (0 ventanas emergentes), engram se actualiza en vivo a la última versión estable verificada y eos gentleman doctor mantiene 100/100 SOVEREIGN_GENTLEMAN_APEX
```
