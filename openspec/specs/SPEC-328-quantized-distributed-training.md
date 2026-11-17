# SPEC-328: FP8 / INT8 Quantized Distributed Training & Mixed-Precision Gradient Scaling Engine

**Specification ID**: `SPEC-328`  
**Change Reference**: `CHANGE-190`  
**Status**: APPROVED  
**Classification**: SOVEREIGN_DISTRIBUTED_CORE  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Functional Requirements (Formal EARS Syntax)

### FR-1: Dual FP8 Numerical Encoding & Decoding (Ubiquitous)

EL SISTEMA implementará representaciones de punto flotante de 8 bits conforms a las normas IEEE/OCP para entrenamiento distribuido, proveyendo formato **E4M3** (1 bit de signo, 4 bits de exponente con sesgo 7, 3 bits de mantisa, valor máximo $448.0$) para activaciones y pesos de la pasada hacia adelante, y formato **E5M2** (1 bit de signo, 5 bits de exponente con sesgo 15, 2 bits de mantisa, valor máximo $57344.0$) para gradientes de la pasada hacia atrás, con cuantización y decuantización bit a bit exacta y acotamiento de sobreflujo.

### FR-2: Symmetric INT8 Quantization with Dynamic Scaling (Ubiquitous)

EL SISTEMA proveerá cuantización entera simétrica INT8 en el rango $[-127, 127]$, calculando dinámicamente el factor de escala $S = \frac{\max(|X|)}{127}$, cuantizando mediante $q = \text{clamp}(\text{round}(X / S), -127, 127)$ y decuantizando exactamente mediante $\hat{X} = q \cdot S$ para tensores y canales de gradientes.

### FR-3: Delayed Scaling Factor Updates with Saturation Guard (Event-Driven)

CUANDO se actualizan factores de escala entre iteraciones consecutivas de entrenamiento distribuido sin barreras síncronas bloqueantes, EL SISTEMA mantendrá un búfer histórico de valores máximos absolutos $a_{\max}$, calculando el factor de escala proyectado $S_{t+1} = \frac{\text{FP8\_MAX}}{\max(a_{\max}, \epsilon)}$, detectando condiciones de saturación si $a_{\max} \cdot S_t > \text{FP8\_MAX}$ y ajustando el margen de seguridad de forma asíncrona.

### FR-4: Adaptive Dynamic Loss Scaling for Mixed-Precision Backpropagation (Event-Driven)

CUANDO se calculan los gradientes hacia atrás en precisión mixta escalada por $S_{\text{loss}}$, EL SISTEMA inspeccionará todos los tensores de gradiente resultantes; SI se detecta cualquier valor anómalo (NaN o Infinito), ENTONCES EL SISTEMA descartará la actualización de pesos del optimizador, reducirá a la mitad el factor de escala ($S_{\text{loss}} \leftarrow S_{\text{loss}} / 2$) y reiniciará el contador de pasos limpios; MIENTRAS transcurran $N_{\text{clean}}$ pasos consecutivos sin desbordamiento, EL SISTEMA duplicará adaptativamente el factor de escala hasta un techo predeterminado $S_{\text{loss\_max}}$.

### FR-5: Quantized Distributed Collective Reduction & Bandwidth Optimization (Ubiquitous)

EL SISTEMA ejecutará reducciones colectivas de gradientes distribuidas (All-Reduce / Reduce-Scatter) transmitiendo las cargas tensoriales en formato cuantizado de 8 bits (1 byte por elemento), garantizando un ahorro estricto de ancho de banda del $50\%$ comparado con representaciones de 16 bits (FP16/BF16) y del $75\%$ comparado con FP32 estándar, acumulando la suma reducida en alta precisión y recuantizando para la difusión.

### FR-6: Numerical Reconstruction Fidelity, Gradient Parity & Cryptographic Receipt (Ubiquitous)

EL SISTEMA garantizará que la fidelidad de reconstrucción entre los gradientes de retropropagación estándar y los gradientes cuantizados satisfaga una relación señal-ruido $\text{SNR} \ge 40\text{ dB}$ y un error absoluto medio $\epsilon \le 10^{-3}$, verificando la estabilidad numérica del entrenamiento y emitiendo un recibo criptográfico firmado SHA-256 en `docs/evidence/QUANTIZED_DISTRIBUTED_TRAINING_RECEIPT.json`.

---

## 2. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-1743: Dual FP8 Bit-Accurate Quantization & Clamping (E4M3 vs E5M2)

```gherkin
ESCENARIO: BDD-1743 - Cuantización exacta de doble formato FP8 (E4M3 vs E5M2)
  DADO un tensor de activaciones en FP32 con valores en rango continuo
  CUANDO se cuantiza y decuantiza utilizando formato E4M3 para activaciones y E5M2 para gradientes
  ENTONCES los valores en E4M3 quedan acotados en [-448.0, 448.0] con 3 bits de mantisa
  Y los valores en E5M2 quedan acotados en [-57344.0, 57344.0] preservando el rango dinámico de gradientes
```

### BDD-1744: Symmetric INT8 Quantization and Dynamic Scale Normalization

```gherkin
ESCENARIO: BDD-1744 - Cuantización simétrica INT8 y normalización de escala
  DADO un tensor continuo con valores arbitrarios de punto flotante
  CUANDO se aplica cuantización simétrica entera lineal INT8
  ENTONCES los valores resultantes se encuentran estrictamente en el intervalo [-127, 127]
  Y la decuantización recupera la distribución con error medio acotado por el tamaño de paso S
```

### BDD-1745: Delayed Scaling Factor History Tracking and Saturation Recovery

```gherkin
ESCENARIO: BDD-1745 - Seguimiento histórico de escala demorada y recuperación de saturación
  DADO un búfer histórico de ventanas de valores máximos observados
  CUANDO el valor a_max actual excede el rango proyectado para el factor de escala vigente
  ENTONCES el motor detecta la condición de saturación sin detener el pipeline
  Y recalcula asíncronamente el nuevo factor de escala para la iteración subsiguiente
```

### BDD-1746: Dynamic Mixed-Precision Loss Scaling and Non-Finite Gradient Backoff

```gherkin
ESCENARIO: BDD-1746 - Escalamiento dinámico de pérdida con retroceso ante gradientes no finitos
  DADO un estado de escalamiento de pérdida en precisión mixta con factor S_loss
  CUANDO se detecta un valor NaN o Infinito en los gradientes retropropagados
  ENTONCES el paso del optimizador es omitido preservando la integridad de los parámetros
  Y el factor S_loss se reduce a la mitad reiniciando la ventana de estabilidad
```

### BDD-1747: Distributed Quantized Gradient All-Reduce Bandwidth Reduction (50% to 75%)

```gherkin
ESCENARIO: BDD-1747 - Reducción de ancho de banda de comunicación colectiva distribuida
  DADO un conjunto de P trabajadores tensoriales sincronizando tensores de gradiente
  CUANDO se ejecuta la reducción colectiva All-Reduce en formato cuantizado de 8 bits
  ENTONCES el volumen de bytes transferido por la red se reduce exactamente en 75% respecto a FP32
  Y en 50% respecto a representaciones estándar de 16 bits FP16/BF16
```

### BDD-1748: Numerical Fidelity Verification (SNR >= 40 dB) & Cryptographic Audit

```gherkin
ESCENARIO: BDD-1748 - Verificación de fidelidad numérica y auditoría criptográfica
  DADO un paso de optimización entrenado con cuantización de 8 bits y escalamiento dinámico
  CUANDO se audita la fidelidad frente a la retropropagación en punto flotante estándar
  ENTONCES la relación señal-a-ruido de cuantización SNR es mayor o igual a 40 dB
  Y el error absoluto medio de gradientes es menor o igual a 10^-3 emitiendo recibo firmado SHA-256
```
