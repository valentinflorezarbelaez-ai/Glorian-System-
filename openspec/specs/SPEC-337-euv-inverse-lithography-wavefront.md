# SPEC-337: Autonomous EUV Optical Proximity Correction & Inverse Lithography Wavefront Engine (EUV-OPC)

**Status**: `APPROVED`

## 1. Functional Requirements (EARS Syntax)

- **FR-1 (Event-Driven)**: CUANDO se evalúa el frente de onda en la pupila de un sistema EUV ($\lambda = 13.5\text{ nm}$, $\text{NA} \in [0.25, 0.55]$) a partir de coeficientes de polinomios ortonormales de Zernike ($Z_4$ desenfoque, $Z_5/Z_6$ astigmatismo, $Z_7/Z_8$ coma, $Z_{11}$ aberración esférica), EL SISTEMA calcula el error de fase RMS $\sigma_\phi$, la razón de Strehl de Maréchal $S = \exp(-\sigma_\phi^2)$ y dictamina si el sistema cumple el límite de difracción de Maréchal ($S \ge 0.80$).
- **FR-2 (Error / Unwanted Condition)**: SI la aberración de frente de onda degrada la razón de Strehl por debajo del umbral de difracción ($S < 0.80$) sin compensación activa o si se suministran parámetros ópticos inválidos ($\lambda \le 0$, $\text{NA} \notin (0, 1)$), ENTONCES EL SISTEMA rechaza la admisión litográfica con `EUVILT_MARÉCHAL_BREACH` o `EUVILT_INVALID_PARAMETERS`.
- **FR-3 (Event-Driven)**: CUANDO se aplica compensación de fase conjugada mediante actuadores de espejo sobre los modos de Zernike medidos, EL SISTEMA reduce el error de frente de onda residual por debajo de $\lambda / 14$ y restituye $S \ge 0.80$.
- **FR-4 (Event-Driven)**: CUANDO se simula la formación de imagen aérea 2D sobre una máscara reticular $M(x, y) \in [0, 1]^{G \times G}$, EL SISTEMA convoluciona la máscara con el núcleo de dispersión de punto (PSF) limitado por difracción y calcula el contorno de fotorresina impreso $R(x, y) = \sigma(\gamma(I(x, y) - I_{\text{th}}))$.
- **FR-5 (Event-Driven)**: CUANDO se ejecuta la síntesis de litografía inversa (ILT) basada en gradiente adjunto sobre un patrón objetivo 2D $Z^*(x, y)$, EL SISTEMA optimiza la transmisión de la máscara reduciendo monótonamente el error $L_2$ de oblea y el Error de Colocación de Borde (EPE) respecto a la máscara sin corregir.
- **FR-6 (Ubiquitous)**: EL SISTEMA expone una auditoría determinista que verifica la ortonormalidad de Zernike, la guarda de Maréchal, la compensación de frente de onda y la convergencia ILT, emitiendo un recibo firmado con SHA-256 en `docs/evidence/EUV_INVERSE_LITHOGRAPHY_RECEIPT.json`.

---

## 2. BDD Acceptance Criteria (GIVEN-WHEN-THEN)

```gherkin
ESCENARIO: BDD-1797 Metrología de Frente de Onda de Zernike y Razón de Strehl de Maréchal
  DADO un escáner EUV a lambda = 13.5 nm y NA = 0.33 o High-NA = 0.55
  CUANDO se evalúa una pupila libre de aberraciones y una pupila con aberraciones moderadas de desenfoque, coma y esférica
  ENTONCES la pupila ideal alcanza Strehl = 1.0 y RMS = 0 nm
  Y la pupila con error RMS = lambda / 14 produce Strehl >= 0.80 conforme al criterio de Maréchal.

ESCENARIO: BDD-1798 Guarda Fail-Closed ante Ruptura del Límite de Difracción de Maréchal y Compensación Activa
  DADO un frente de onda con aberración severa (Strehl < 0.80)
  CUANDO se intenta admitir la exposición sin corrección
  ENTONCES el motor rechaza la exposición con código EUVILT_MARECHAL_BREACH
  Y al activar la compensación conjugada de espejo (actuadores de Zernike), el Strehl corregido supera 0.98 y es admitido.

ESCENARIO: BDD-1799 Simulación 2D de Imagen Aérea Difractiva y Umbral de Fotorresina
  DADO un patrón objetivo 2D en una rejilla G x G e iluminación EUV
  CUANDO se calcula la imagen aérea difractada y la respuesta sigmoide de fotorresina
  ENTONCES la intensidad aérea se mantiene en [0, 1], preserva la simetría de un objetivo simétrico
  Y refleja el redondeo de esquinas y acortamiento de extremos propio de sistemas limitados por difracción.

ESCENARIO: BDD-1800 Síntesis de Máscara por Litografía Inversa (ILT) con Gradiente Adjunto
  DADO un patrón objetivo 2D (contacto o barra en L/T) que sufre erosión difractiva bajo máscara binaria directa
  CUANDO se ejecuta el optimizador ILT durante K iteraciones de gradiente adjunto
  ENTONCES la pérdida L2 de oblea y el Error de Colocación de Borde (EPE) disminuyen monótonamente
  Y la máscara sintetizada reduce el EPE en más de un 50% respecto a la máscara sin corregir.

ESCENARIO: BDD-1801 Escalamiento de Resolución de Rayleigh entre EUV Estándar (0.33 NA) y High-NA (0.55 NA)
  DADO una longitud de onda fija lambda = 13.5 nm
  CUANDO se compara la frecuencia de corte pupilar y resolución de Rayleigh entre NA = 0.33 y NA = 0.55
  ENTONCES el semi-paso de resolución de High-NA es exactamente 0.33 / 0.55 = 60% del de EUV estándar (mejora del 40%).

ESCENARIO: BDD-1802 Auditoría Determinista y Recibo Criptográfico SHA-256
  DADO el motor EosEuvInverseLithographyWavefrontCore
  CUANDO se ejecuta audit()
  ENTONCES todas las verificaciones (zernikeOrthonormal, marechalGuardEnforced, wavefrontCompensated, iltLossReduced, epeImproved) son true
  Y se emite el recibo firmado en docs/evidence/EUV_INVERSE_LITHOGRAPHY_RECEIPT.json.
```
