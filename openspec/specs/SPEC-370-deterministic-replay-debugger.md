# SPEC-370: Deterministic Replay Debugger & MCTS Time-Travel Studio

**Document ID**: `SPEC-370-deterministic-replay-debugger`  
**Change Target**: `CHANGE-232`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `APPROVED`  
**Lifecycle Tier**: `production`  
**Author**: `user:valentin-florez-arbelaez` & Antigravity  
**Date**: `2026-11-19`

---

## 1. Functional Requirements (EARS Standard)

- **FR-370-01 (Trajectory Checkpointing)**:  
  `CUANDO` un agente ejecuta una acción o transición de estado, `EL SISTEMA` capturará un checkpoint discreto inmutable con tick monótono, tipo de acción, carga útil, snapshot de estado y hash SHA-256.

- **FR-370-02 (Bit-Exact Time-Travel Rewind)**:  
  `CUANDO` se solicita retroceder a un tick o checkpoint previo, `EL SISTEMA` restaurará el estado del agente con exactitud bit a bit sin mutar ni corromper el historial de ejecución.

- **FR-370-03 (Counterfactual MCTS Branching)**:  
  `CUANDO` se inicia una bifurcación contrafactual desde un checkpoint histórico, `EL SISTEMA` creará una rama MCTS aislada permitiendo explorar hipótesis y acciones alternativas preservando la rama canónica original.

- **FR-370-04 (UCT Evaluation & Winning Path Selection)**:  
  `MIENTRAS` se exploran ramas contrafactuales, `EL SISTEMA` evaluará la función de recompensa mediante la fórmula UCT (Upper Confidence bounds for Trees) y seleccionará la ruta con mayor recompensa acumulada.

- **FR-370-05 (Time-Slider Step Navigation)**:  
  `CUANDO` el usuario o agente interactúa con el slider temporal paso a paso (step-forward / step-backward), `EL SISTEMA` navegará secuencialmente a través de los checkpoints emitiendo el diff de estado correspondiente.

- **FR-370-06 (Bounded Trajectory Pruning)**:  
  `SI` la trayectoria supera el límite máximo de checkpoints configurado, `ENTONCES EL SISTEMA` comprimirá o podará los ticks intermedios no críticos preservando intactos los checkpoints clave y ramas activas.

- **FR-370-07 (Cryptographic Receipt & Audit)**:  
  `EL SISTEMA` emitirá un recibo criptográfico inmutable SHA-256 certificando la integridad de la trayectoria, checkpoints registrados, ramas contrafactuales y métricas de reproducibilidad.

---

## 2. Acceptance Criteria (BDD Standard)

```gherkin
ESCENARIO: BDD-1999 - Discrete Checkpointing of Agent Execution Trajectory
  DADO un agente ejecutando una secuencia de acciones
  CUANDO el registrador de replay captura cada paso
  ENTONCES cada checkpoint contiene tick monótono, tipo de acción, snapshot de estado y firma SHA-256
  Y ningún checkpoint presenta pérdida de atributos obligatorios.

ESCENARIO: BDD-2000 - Bit-Exact State Restoration via Time-Travel Rewind
  DADO una trayectoria grabada con N checkpoints
  CUANDO se solicita rebobinar al tick K (donde K < N)
  ENTONCES el estado restaurado coincide de forma idéntica con el snapshot capturado en el tick K
  Y el hash SHA-256 del estado actual es equivalente al del checkpoint original.

ESCENARIO: BDD-2001 - Counterfactual MCTS Alternative Branching
  DADO un checkpoint histórico en el tick K
  CUANDO el agente crea una bifurcación contrafactual con una acción alternativa
  ENTONCES se crea una nueva rama MCTS aislada sin mutar la trayectoria canónica
  Y la rama hija referencia correctamente el nodo padre en el tick K.

ESCENARIO: BDD-2002 - UCT Scoring and Optimal Trajectory Selection
  DADO múltiples ramas contrafactuales exploradas desde un mismo punto
  CUANDO el motor de árbol evalúa las recompensas y visitas
  ENTONCES se calcula el puntaje UCT para cada rama
  Y se selecciona determinísticamente la ruta con mayor recompensa.

ESCENARIO: BDD-2003 - Interactive Time-Slider Step Navigation
  DADO una trayectoria cargada en el depurador
  CUANDO se ejecutan comandos de avance o retroceso de paso
  ENTONCES el cursor temporal se desplaza con precisión de un tick
  Y se emite el delta de estado entre el paso actual y el siguiente.

ESCENARIO: BDD-2004 - Full Diagnostic Audit and Replay Debugger Receipt
  DADO una sesión de depuración y trayectoria completa
  CUANDO se invoca la auditoría del estudio de tiempo y replay
  ENTONCES se emite un recibo formal SHA-256 con el resumen de checkpoints, ramas y reproducibilidad
  Y el reporte cumple con los estándares del plano de control de Glorian.
```
