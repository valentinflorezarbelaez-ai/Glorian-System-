# SPEC-044: EOS TIER-0 PRINCIPAL HARDENING & GENTLEMAN AI STACK CO-GOVERNANCE (v50.0.0)

## 1. Specification Metadata
- **Spec ID**: `SPEC-044`
- **Title**: EOS Tier-0 Principal Engineering Hardening (MCP Confinement, ToolAnnotations, Native SQLite WAL+FTS5, TypeScript AST) & Unified Gentleman AI Stack Co-Governance in Antigravity
- **Status**: `APPROVED`
- **Tier**: `BIG_TECH_TIER_0`
- **Applicable Standards**: Model Context Protocol (`2024-11-05` & `2025-03-26` ToolAnnotations), Node.js Native `node:sqlite` (WAL + FTS5), TypeScript Compiler AST API, Google Antigravity Customization Specification, Gentleman Programming Open-Source AI Ecosystem (`gentle-ai` v4, `engram` v3, `gga` v2, `agent-teams-lite`), EOS Seven Inviolable Commandments
- **Traceability**: `CHANGE-037`, `INTAKE-037`, `PLAN-037`, `TASKS-037`, `ADR-050`

---

## 2. Functional Requirements (EARS Patterns)

### FR-132: Total MCP Path Confinement & Host CWD Independence
- **EARS Pattern (Error / Unwanted Condition)**: SI cualquier herramienta del servidor MCP `eos-system` recibe un argumento de ruta de archivo o directorio (`filePath`, `dirPath`, `targetDir`, `projectRoot`), ENTONCES EL SISTEMA resolverá y confinará la ruta exclusivamente a través de `resolveProjectPath()` respecto a `this.projectRoot` (nunca `process.cwd()`), rechazando de forma fail-closed enlaces simbólicos externos o intentos de escape fuera de la raíz autorizada.

### FR-133: Modular MCP 2025-03-26 ToolAnnotations & Anti-Bloat Tool Profiles
- **EARS Pattern (Event-Driven)**: CUANDO un cliente MCP solicita `tools/list` a `EosMcpServer`, EL SISTEMA enriquecerá cada herramienta con `annotations` estándar MCP `2025-03-26` (`title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) y filtrará el catálogo según el perfil configurado (`core` para el conjunto enfocado de herramientas reales de ingeniería o `full` para retrocompatibilidad completa).

### FR-134: Zero-Dependency Durable Bitemporal Ledger via Native `node:sqlite` (WAL + FTS5)
- **EARS Pattern (Ubiquitous)**: EL SISTEMA proveerá un motor de persistencia durable `EosDurableSqliteLedger` construido exclusivamente sobre `node:sqlite` nativo (`0` dependencias npm externas) con modo `WAL`, índice de búsqueda textual `FTS5` y encadenamiento criptográfico monotónico SHA-256 (`prevHash` -> `entryHash`) accesible vía MCP (`eos_sqlite_ledger`) y CLI (`eos ledger`).

### FR-135: Compiler-Grade TypeScript AST Architecture & Strip-Only Verifier
- **EARS Pattern (Event-Driven)**: CUANDO se invoca `EosTypeScriptAstAnalyzer` (`eos_ast_analyze` / `eos ast`), EL SISTEMA analizará los módulos `.ts` mediante nodos reales del AST del compilador TypeScript (`ts.createSourceFile`) para medir complejidad ciclomática exacta, importaciones externas prohibidas en Layer-0 y construcciones incompatibles con strip-only TypeScript (`enum`, `namespace`, propiedades de parámetro en constructor) sin falsos positivos por expresiones regulares.

### FR-136: Unified EOS + Gentleman AI Stack Co-Governance in Antigravity
- **EARS Pattern (Ubiquitous)**: EL SISTEMA integrará y auditará mediante `EosGentlemanStackBridge` (`eos_gentleman_audit` / `eos gentleman doctor`) la coexistencia armónica entre el Plano de Control EOS (`eos-system` MCP, `eos-governance` hooks) y el stack completo de Gentleman Programming (`gentle-ai` CLI, `engram` MCP + CLI, `gga` CLI + `.gga`, `context7` MCP y los skills `sdd-*` + `judgment-day` de `agent-teams-lite`) dentro de Google Antigravity, preservando intacta la Constitución de EOS.

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
ESCENARIO: BDD-128: Confinamiento Total de Rutas e Independencia de process.cwd() en MCP
  DADO una instancia de EosMcpServer ejecutándose desde un directorio de trabajo externo (os.tmpdir())
  CUANDO se invocan eos_refactor_audit y eos_refactor_execute con rutas relativas ("src/core", ".") o con rutas de escape ("../../outside")
  ENTONCES las rutas relativas dentro del proyecto se resuelven limpiamente contra projectRoot y retornan auditorías válidas
  Y cualquier ruta fuera de projectRoot es rechazada de forma fail-closed sin acceder al disco externo

ESCENARIO: BDD-129: Perfiles MCP Core/Full y ToolAnnotations 2025-03-26
  DADO el catálogo modular EosMcpToolCatalog conectado a EosMcpServer
  CUANDO se solicita tools/list en perfil "full" y en perfil "core"
  ENTONCES el 100% de las herramientas incluyen annotations válidas (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
  Y el perfil "core" expone únicamente el conjunto enfocado Tier-0 (<= 30 herramientas) reduciendo el ruido cognitivo del agente

ESCENARIO: BDD-130: Persistencia Durable Zero-Deps con node:sqlite WAL + FTS5 y Cadena SHA-256
  DADO una base de datos EosDurableSqliteLedger en disco temporal
  CUANDO se insertan recibos de misiones y decisiones arquitectónicas, se cierra la conexión y se reabre en una nueva instancia
  ENTONCES las búsquedas FTS5 recuperan los registros persistidos con latencia sub-milisegundo
  Y verifyChainIntegrity() confirma intacta la cadena monotónica SHA-256 (0 bloques alterados)

ESCENARIO: BDD-131: Análisis Estático Real sobre AST del Compilador TypeScript
  DADO módulos TypeScript Layer-0 reales y muestras con construcciones prohibidas (enum, import externo)
  CUANDO EosTypeScriptAstAnalyzer analiza el código mediante ts.createSourceFile
  ENTONCES certifica 0 violaciones strip-only y 0 dependencias externas en src/core/
  Y detecta con precisión exacta de nodo AST cualquier enum o dependencia no permitida ignorando comentarios y literales de texto

ESCENARIO: BDD-132: Co-Gobernanza EOS + Gentle AI Stack al 100% en Antigravity
  DADO el entorno Windows y la configuración global de Google Antigravity
  CUANDO se ejecuta EosGentlemanStackBridge.auditStack() y eos_gentleman_audit vía MCP
  ENTONCES verifica activos eos-system MCP, gentle-ai CLI, engram MCP+CLI, gga CLI+.gga, context7 MCP y los skills sdd-* + judgment-day + eos-gentleman-synergy
  Y emite un puntaje >= 95/100 (SOVEREIGN_GENTLEMAN_APEX) con recibo SHA-256 de 64 caracteres
```
