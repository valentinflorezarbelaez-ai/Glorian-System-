# SPEC-336: Autonomous Physics-Informed Neural Network (PINN) & Symplectic Hamiltonian PDE Integrator

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO se integra un sistema hamiltoniano separable $H(q, p) = T(p) + V(q)$ mediante el integrador simpléctico de Störmer-Verlet (orden 2) o Yoshida (orden 4), EL SISTEMA preserva el volumen de espacio de fases ($\det J = 1$) y mantiene la deriva de energía $|\Delta H|$ acotada sin crecimiento secular a largo plazo.
- **FR-2 (Error / Unwanted Condition)**: SI se solicita avanzar una ecuación en derivadas parciales de advección-difusión con un paso temporal $\Delta t$ que viola la condición de estabilidad de Courant-Friedrichs-Lewy ($C_{\text{adv}} + 2 C_{\text{diff}} > 1$), ENTONCES EL SISTEMA rechaza la ejecución con el código `PINN_CFL_INSTABILITY` antes de propagar inestabilidades numéricas.
- **FR-3 (Event-Driven)**: CUANDO se evalúa un ansatz espectral/neuronal $u_\theta(x, t)$ sobre una malla de puntos de colocación interiores, de frontera e iniciales, EL SISTEMA calcula el residuo diferencial de la EDP $\mathcal{R}(x, t) = \partial_t u_\theta + c\,\partial_x u_\theta - \nu\,\partial_{xx} u_\theta - f(x, t)$ y la pérdida física compuesta $\mathcal{L}_{\text{PINN}} = w_{\text{pde}}\mathcal{L}_{\text{pde}} + w_{\text{bc}}\mathcal{L}_{\text{bc}} + w_{\text{ic}}\mathcal{L}_{\text{ic}}$.
- **FR-4 (Event-Driven)**: CUANDO se ejecuta el optimizador de colocación física sobre los pesos $\theta$, EL SISTEMA reduce monótonamente la pérdida compuesta $\mathcal{L}_{\text{PINN}}$ y satisface las condiciones de frontera e iniciales dentro de la tolerancia especificada.
- **FR-5 (State-Driven)**: MIENTRAS se comparan trayectorias hamiltonianas bajo un mismo paso temporal $\Delta t$, EL SISTEMA certifica que la deriva máxima de energía de Yoshida (orden 4) es estrictamente menor que la de Störmer-Verlet (orden 2), y esta a su vez órdenes de magnitud menor que la de Euler explícito.
- **FR-6 (Ubiquitous)**: EL SISTEMA expone una auditoría determinista que verifica la conservación simpléctica, la guarda CFL, la reducción de residuo PINN y emite un recibo firmado con SHA-256 en `docs/evidence/PINN_HAMILTONIAN_PDE_RECEIPT.json`.

---

## 2. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1791 Integración Simpléctica Störmer-Verlet y Yoshida vs Euler Explícito
  DADO un oscilador hamiltoniano acoplado o no lineal con estado inicial (q0, p0)
  CUANDO se integra durante N pasos con Euler explícito, Störmer-Verlet y Yoshida de 4to orden
  ENTONCES Euler explícito presenta deriva secular de energía mientras que Verlet y Yoshida mantienen la energía acotada
  Y la deriva máxima de energía de Yoshida es estrictamente inferior a la de Verlet y preserva det(J) = 1.

ESCENARIO: BDD-1792 Guarda Fail-Closed de Estabilidad Courant-Friedrichs-Lewy (CFL) y Difusión
  DADO un problema de advección-difusión 1D con velocidad c, viscosidad nu y espaciamiento dx
  CUANDO se evalúa un paso dt estable (C_adv + 2*C_diff <= 1) y un paso dt inestable (> 1)
  ENTONCES el paso estable es admitido y evoluciona sin oscilaciones espurias
  Y el paso inestable es rechazado inmediatamente con código PINN_CFL_INSTABILITY.

ESCENARIO: BDD-1793 Evaluación de Residuo Diferencial en Puntos de Colocación e Invariantes de Frontera
  DADO un campo analítico de prueba u(x, t) = exp(-nu * pi^2 * t) * sin(pi * x) para la ecuación del calor
  CUANDO se evalúa el operador diferencial de colocación en puntos interiores y de frontera
  ENTONCES el residuo de la EDP y la pérdida de frontera son cercanos a cero (< 1e-6)
  Y una perturbación que viola las condiciones de frontera incrementa proporcionalmente L_bc y L_pinn.

ESCENARIO: BDD-1794 Entrenamiento y Convergencia del Solucionador PINN por Colocación
  DADO un problema de valores en la frontera e iniciales para una EDP de advección-difusión-reacción
  CUANDO se ajustan los pesos de la base de características de Fourier mediante colocación física regularizada
  ENTONCES la pérdida compuesta L_pinn posterior al ajuste es al menos 95% menor que la pérdida inicial
  Y la solución aprendida concuerda con la solución analítica de referencia con error L2 < 1e-3.

ESCENARIO: BDD-1795 Conservación del Invariante de Volumen de Espacio de Fases (Teorema de Liouville)
  DADO una nube de estados iniciales en el espacio de fases (q, p)
  CUANDO se propaga bajo el mapa simpléctico de Störmer-Verlet o Yoshida
  ENTONCES el determinante jacobiano numérico del mapa de flujo es 1.0 dentro de 1e-9.

ESCENARIO: BDD-1796 Auditoría Determinista y Recibo Criptográfico SHA-256
  DADO el motor EosPhysicsInformedHamiltonianPdeCore
  CUANDO se ejecuta audit()
  ENTONCES todas las verificaciones (symplecticEnergyBounded, yoshidaBeatsVerlet, cflGuardEnforced, pinnLossConverged, liouvilleVolumePreserved) resultan en true
  Y se emite el recibo firmado en docs/evidence/PINN_HAMILTONIAN_PDE_RECEIPT.json.
```
