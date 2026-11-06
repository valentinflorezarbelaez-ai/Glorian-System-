# SPEC-043: SOVEREIGN ANTIGRAVITY MCP CONTROL PLANE & DIRECTOR MESH (v49.0.0)

## 1. Specification Metadata
- **Spec ID**: `SPEC-043`
- **Title**: Sovereign Antigravity MCP Control Plane, Active Mission Director & Lifecycle Governance Plugin
- **Status**: `APPROVED`
- **Tier**: `BIG_TECH_TIER_0`
- **Applicable Standards**: Model Context Protocol (2024-11-05 & 2025-03-26), Google Antigravity Customization Specification (`mcp_config.json`, `plugin.json`, `hooks.json`, `SKILL.md`), IEEE 830 / ISO 29148, EOS Seven Inviolable Commandments
- **Traceability**: `CHANGE-036`, `INTAKE-036`, `PLAN-036`, `TASKS-036`, `ADR-049`

---

## 2. Functional Requirements (EARS Patterns)

### FR-128: Active Antigravity Mission Classification & Tool DAG Direction
- **EARS Pattern (Event-Driven)**: CUANDO Antigravity recibe una directiva de ingeniería y consulta `eos_antigravity_direct`, EL SISTEMA clasificará determinísticamente la misión en un perfil operativo (`SDD_FULL_21_STEP`, `ARCHITECTURE_AUDIT`, `SECURITY_HARDENING`, `FLEET_ORCHESTRATION`, `PERFORMANCE_TUNING`, `BUGFIX_FDIR`), verificará las precondiciones de la Barrera de Escritura Externa (Ley IV) frente a `docs/projects/registry.json`, prescribirá el DAG ordenado de herramientas MCP de EOS a ejecutar y emitirá un recibo criptográfico SHA-256 inmutable.

### FR-129: Full Antigravity MCP Protocol Handshake, Instructions & Prompts
- **EARS Pattern (Event-Driven)**: CUANDO el Language Server de Antigravity envía `initialize`, `ping`, `prompts/list` o `prompts/get` al servidor `eos-system`, EL SISTEMA negociará la versión del protocolo (`2024-11-05` o `2025-03-26`), inyectará el manual operativo soberano en el campo `instructions` (para materializar `instructions.md`), responderá a `ping` con latencia sub-milisegundo y servirá plantillas de prompts gobernadas por EARS/BDD.

### FR-130: Gamma Security Barrier Lifecycle Hook for Antigravity
- **EARS Pattern (Error / Unwanted Condition)**: SI una invocación `PreToolUse` sobre `run_command` en Antigravity contiene patrones destructivos prohibidos (`rm -rf /`, `git push --force origin main`, `DROP DATABASE`, `Format-Volume`), ENTONCES EL SISTEMA devolverá `{"decision": "deny"}` con diagnóstico explícito de la Barrera Gamma (Ley VI); en caso contrario devolverá `{"decision": "allow"}` sin bloquear el flujo de desarrollo.

### FR-131: Antigravity Control Plane Doctor & Junction Self-Healing
- **EARS Pattern (Ubiquitous)**: EL SISTEMA expondrá la herramienta MCP `eos_antigravity_doctor` y los comandos CLI `eos antigravity [direct|doctor|install]` para auditar y reparar enlaces NTFS (`plugins/eos-governance`, `skills`), validar esquemas de `plugin.json`, `hooks.json` y `SKILL.md`, verificar variables `EOS_FLEET_*_PATH` en `mcp_config.json` sin exponer ni alterar secretos de terceros y garantizar cero servidores MCP duplicados.

---

## 3. Acceptance Criteria (BDD Standard)

```gherkin
ESCENARIO: BDD-124: Dirección Activa de Misión y Verificación de Barrera Externa
  DADO una directiva de ingeniería enviada desde Antigravity hacia EosAntigravityDirector.directMission()
  CUANDO el objetivo es un repositorio registrado o un directorio externo no registrado
  ENTONCES el director clasifica el perfil de misión, prescribe el DAG exacto de herramientas MCP de EOS
  Y evalúa correctamente el estado AUTHORIZED o BLOCKED_BY_LAW_IV con recibo SHA-256 de 64 caracteres

ESCENARIO: BDD-125: Negociación MCP 2024-11-05 / 2025-03-26, Instructions, Ping y Prompts
  DADO una instancia activa de EosMcpServer
  CUANDO Antigravity envía solicitudes JSON-RPC initialize, ping, prompts/list, prompts/get y resources/read
  ENTONCES initialize retorna instructions no vacías y negocia la versión solicitada sin romper compatibilidad
  Y ping, prompts/list, prompts/get y eos://antigravity/director-playbook responden con estructuras válidas

ESCENARIO: BDD-126: Barrera Gamma en Hook PreToolUse y Mensaje Soberano en SessionStart
  DADO el script de hook nativo integrations/antigravity/eos-governance/scripts/eos-hook.mjs
  CUANDO recibe un payload SessionStart o un payload PreToolUse con comando seguro vs comando destructivo
  ENTONCES SessionStart inyecta el contexto del plano de control EOS en formato protojson válido
  Y PreToolUse permite comandos seguros ("allow") y bloquea comandos catastróficos ("deny")

ESCENARIO: BDD-127: Diagnóstico Integral e Instalación Idempotente en Antigravity
  DADO el entorno de configuración de Antigravity con mcp_config.json, plugins/eos-governance y skills/
  CUANDO se ejecuta EosAntigravityDirector.auditAntigravityIntegration() y eos antigravity doctor
  ENTONCES el puntaje de salud alcanza >= 95/100 sin enlaces rotos ni servidores MCP duplicados
  Y todas las herramientas son despachables tanto por MCP como por CLI con código de salida 0
```
