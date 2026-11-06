# EOS System — especificación verificable del repositorio

Esta especificación describe el comportamiento comprobable del checkout. Una prueba local demuestra únicamente el comportamiento cubierto en ese entorno; no acredita disponibilidad de producción, seguridad integral, compatibilidad con proveedores ni certificación externa.

## Alcance actual

EOS es un toolkit local de ingeniería de software compuesto por una interfaz web, una CLI Node.js, un servidor MCP stdio, un transporte MCP HTTP/SSE local con herramientas limitadas, módulos TypeScript de análisis y ejemplos de módulos Go y Rust. Las pantallas y los endpoints marcados como demostración no ejecutan los servicios o productos a los que hacen referencia.

### Requisitos funcionales

* **FR-001 — Interfaz web de alcance explícito.** La interfaz puede presentar navegación, ejemplos, fixtures y borradores locales. No ejecuta comandos del sistema, pruebas, despliegues ni sondas de producción desde el navegador.
* **FR-002 — CLI local.** La CLI ofrece las funciones declaradas en `package.json` y `bin/eos.mjs`. Cada comando documenta si inspecciona, propone o escribe; los resultados locales no se presentan como certificaciones externas.
* **FR-003 — MCP stdio.** El servidor stdio expone las herramientas registradas en `src/mcp/eosMcpServer.ts`. Las operaciones que escriben deben requerir una opción booleana explícita y validar las rutas dentro del proyecto configurado.
* **FR-004 — MCP HTTP/SSE local.** El servidor HTTP enlaza a `127.0.0.1` por defecto, exige un bearer token aleatorio por proceso y admite un token configurado de al menos 32 bytes. Un `Origin` se acepta solo si coincide exactamente con `EOS_MCP_ALLOWED_ORIGINS`; no hay CORS abierto por defecto. El transporte HTTP presenta solo seis herramientas de lectura, limita el cuerpo a 1 MiB, los mensajes a 10 segundos y las sesiones SSE a 16. Las respuestas de error no contienen stacks.
* **FR-005 — Verificación de tipos.** `npm run typecheck` comprueba `src/**/*.ts` con TypeScript en modo estricto y sin emitir archivos.
* **FR-006 — Compuerta Node.** `npm run verify:strict` ejecuta el escaneo configurado de cinco patrones de credenciales, asserts estáticos de la landing, comprobación SRI, verificación de cero dependencias runtime, simulaciones JavaScript acotadas, sintaxis JavaScript, type-check de TypeScript, todas las suites `test/*.test.mjs`, comprobaciones estáticas de markup/peso, y smoke tests in-process con handlers API simulados.
* **FR-007 — Ejemplos poliglotas.** La CI comprueba formato, tests y compilación del módulo Go en `templates/spotify-go-microservice` y formato, tests y build release del crate Rust en `templates/spotify-rust-audio-core`. Son plantillas de ejemplo, no servicios de producción de EOS.
* **FR-008 — Versionado.** `package.json` es la fuente de versión de EOS. La API de salud y los servidores MCP deben reportar esa versión, no constantes independientes.
* **FR-009 — Evidencia local.** La compuerta puede emitir un digest SHA-256 del inventario local, un recibo de comprobaciones configuradas y un reporte SARIF de esos asserts. Estos artefactos no son un SBOM estándar, una atestación firmada, un análisis SAST general, una verificación TLC/TLA+ ni prueba de despliegue.
* **FR-010 — Flujo local de proyecto.** `eos flow` integra inspección y plan local, creación de un worktree desde un checkout limpio, validación sin red en Docker, revisión de diff y fast-forward local condicionado a un SHA-256 aprobado. No implementa edición autónoma, commit automático, push ni despliegue.
* **FR-011 — Estado y cierre de workflow.** `flow status` reporta el estado local guardado. `flow close` elimina el worktree limpio, preserva la rama y rechaza archivos sin commit salvo que se solicite `--force` explícitamente.
* **FR-012 — Portabilidad del flujo central.** CI ejecuta las pruebas de ciclo de vida y CLI de `eos flow` en Windows, macOS y Linux. Esta matriz valida el CLI central; el sandbox Docker y la suite completa permanecen en Linux.

## Límites y estados de capacidad

| Capacidad | Estado comprobable | Límite conocido |
|---|---|---|
| Análisis de arquitectura y grafo local | Implementado con heurísticas y análisis estático | No es un compilador semántico ni prueba ausencia de defectos |
| Simulaciones de estado y fallas | Implementadas como simulaciones JavaScript acotadas | No son model checking exhaustivo, Jepsen ni pruebas de red distribuida |
| MCP stdio | Implementado | Mantiene el catálogo de herramientas locales; cada integración cliente requiere su configuración |
| MCP HTTP/SSE | Implementado con política HTTP de solo lectura | Token local y allowlist de origen son configuración operativa necesaria para clientes de navegador |
| Aislamiento de ejecución | Requiere Docker Linux y una imagen local fijada por digest | Defensa en profundidad sobre Docker/host; no es una microVM |
| Flujo `eos flow` | Inspección, plan heurístico, worktree, validación en sandbox, diff y aprobación por hash implementados | Requiere una imagen Docker local con las herramientas/dependencias del proyecto; falta piloto externo y métricas de operación |
| SAST general, SBOM CycloneDX, atestación firmada, TLC | No implementados por la compuerta actual | No deben afirmarse como ejecutados hasta integrar herramientas reales y guardar sus resultados |
| Integraciones con Cursor, Antigravity, Palantir, Spotify u otros proveedores | No implicadas por referencias o fixtures | Se necesita integración real, credenciales y pruebas específicas para afirmar conectividad |

## Invariantes operativas

1. Una etiqueta `PASS` identifica únicamente el comando, las entradas y los asserts que se ejecutaron.
2. Las demos, simulaciones, fixtures, heurísticas y borradores deben declararse como tales junto a sus resultados.
3. Las propuestas de cambio y los modos de planificación son de solo lectura. Las escrituras requieren una acción explícita, límites de ruta y revisión de diff.
4. El transporte MCP HTTP/SSE no hereda el catálogo completo de escritura del servidor stdio.
5. Las pruebas no deben dejar artefactos en el repositorio salvo que ese artefacto sea su salida declarada; cada prueba limpia los temporales que crea.
6. CI prueba la suite Node completa antes de que el comando configurado de build termine con éxito; Go y Rust tienen jobs de compilación y pruebas separados.

## Flujo central de ingeniería

El flujo local implementado es: `flow inspect` → `flow plan` → `flow start` → trabajo y commit en el worktree → `flow validate` → `flow review` → `flow apply --confirm-diff=<sha256>` → `flow status`/`flow close`. El plan es heurístico y no edita código. La validación corre en el sandbox Docker sin red y descarta las escrituras de la ejecución. Review solo acepta el HEAD que pasó validación, exige worktree limpio y presenta el diff comprometido. Apply vuelve a verificar el hash, exige base sin cambios y limpia, y hace únicamente fast-forward local. Close elimina el worktree, pero conserva la rama; las modificaciones sin commit se conservan por defecto y solo pueden descartarse con una opción explícita. El flujo no hace push ni despliegue. La adopción en repositorios externos y las métricas de aceptación, falsos positivos, fallos, tiempo y reversión requieren pilotos.

## Criterios de aceptación

```gherkin
ESCENARIO: MCP HTTP/SSE protege el servicio local
  DADO que el servidor se inició con su token de proceso
  CUANDO una solicitud HTTP no presenta el bearer token correcto
  ENTONCES recibe HTTP 401 y no se despacha ninguna herramienta
  Y un Origin no configurado recibe HTTP 403
  Y tools/list incluye solamente la allowlist HTTP de lectura
  Y el cuerpo, tiempo de lectura y cantidad de sesiones están acotados
  Y los errores no exponen stack ni rutas locales.

ESCENARIO: La compuerta ejecuta el contrato del repositorio
  DADO que se instalaron las dependencias bloqueadas
  CUANDO CI ejecuta scripts/verify-cicd-pipeline.mjs
  ENTONCES todos los archivos test/*.test.mjs descubiertos se ejecutan
  Y src/**/*.ts pasa el type-check
  Y cualquier fallo produce un código distinto de cero antes de completar el build.

ESCENARIO: La evidencia declara su alcance real
  DADO que la compuerta Node termina correctamente
  CUANDO se escribe el recibo local
  ENTONCES el recibo identifica un inventario y smoke checks simulados
  Y no afirma generar SBOM, firmar atestaciones, ejecutar SAST general, TLC ni despliegues.

ESCENARIO: Un análisis de proyecto no cambia archivos
  DADO un repositorio local elegido por el usuario
  CUANDO EOS inspecciona o propone un plan
  ENTONCES la inspección deja intacto el working tree
  Y el plan queda marcado como heurístico y de solo lectura.

ESCENARIO: La integración local requiere revisar la misma versión que pasó validación
  DADO un workflow creado desde una rama base limpia y nombrada
  CUANDO se valida un commit en el worktree aislado y se revisa su diff
  ENTONCES validate no conserva escrituras de la prueba
  Y review exige que HEAD coincida con el commit validado y presenta el SHA-256 del diff
  Y apply requiere ese hash, confirma que la base no cambió y hace solo fast-forward local
  Y ninguna etapa hace commit automático, push o despliegue.

ESCENARIO: Los ejemplos de Go y Rust permanecen construibles
  DADO un cambio en cualquiera de las plantillas
  CUANDO corren los jobs poliglotas de CI
  ENTONCES se validan formato, tests y compilación con el toolchain fijado
  Y el estado del job no se confunde con una publicación o despliegue.
```
