# SPEC-327: Universal Reverse Engineering Anything (REA) Engine

**Specification ID**: `SPEC-327`  
**Change Reference**: `CHANGE-189`  
**Status**: APPROVED  
**Classification**: SOVEREIGN_ANALYSIS_CORE  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Functional Requirements (Formal EARS Syntax)

### FR-1: Multi-Format Magic Identification & Structural Dispatch (Ubiquitous)

EL SISTEMA identificará de forma determinista el formato del binario o archivo objetivo inspeccionando sus números mágicos iniciales y encabezados estructurales (e.g., `\x00asm` para WASM, `\x7fELF` para ELF, `MZ` para PE/COFF, y encabezados Pickle/JSON para `.asar`), clasificando el archivo dentro de los tipos soportados o señalando formato no estructurado.

### FR-2: Electron ASAR Archive Extraction & Virtual Filesystem Synthesis (Event-Driven)

CUANDO se suministra un archivo empaquetado de Electron (`.asar`), EL SISTEMA decodificará el encabezado binario Pickle de 16 bytes y el índice de directorios JSON, extrayendo las rutas de archivos, tamaños y desplazamientos relativos, construyendo un árbol de sistema de archivos virtual en memoria sin invocar herramientas externas.

### FR-3: Minified JavaScript & Web Bundle Decomposition (Event-Driven)

CUANDO se analiza un paquete web ofuscado o minificado, EL SISTEMA escaneará los límites de módulos reconocibles (e.g., firmas Webpack `__webpack_require__`, wrappers UMD/IIFE y ESM runtime exports), computando frecuencias de identificadores, tablas de símbolos y grafos de dependencia entre módulos.

### FR-4: Section-Level Shannon Entropy & Packed Payload Detection (Ubiquitous)

EL SISTEMA calculará la entropía de Shannon $H = -\sum_{i=0}^{255} p_i \log_2(p_i)$ para cada sección o segmento de 256 bytes del archivo objetivo, clasificando cualquier segmento con $H \ge 7.2\text{ bits/byte}$ como potencialmente cifrado, comprimido o empaquetado (packed).

### FR-5: Control-Flow Graph (CFG) & Basic Block Extraction (Event-Driven)

CUANDO se procesa una secuencia lineal de instrucciones de ensamblador o bytecode, EL SISTEMA particionará el flujo en bloques básicos delimitados por instrucciones de salto (condicional, incondicional, llamada, retorno), construyendo un Grafo Acíclico Dirigido (DAG) de flujo de control con aristas de tipo `FALLTHROUGH`, `BRANCH_TRUE`, `BRANCH_FALSE` y `CALL`.

### FR-6: Telemetry, Verifiable Evidence & Cryptographic Receipt (Ubiquitous)

EL SISTEMA verificará que todas las deducciones e inferencias de ingeniería inversa estén fundamentadas exclusivamente en evidencia binaria reproducible, emitiendo un recibo firmado SHA-256 en `docs/evidence/REVERSE_ENGINEERING_RECEIPT.json`.

---

## 2. Acceptance Criteria (BDD GIVEN-WHEN-THEN)

### BDD-1737: Magic Byte Identification & Format Classification

```gherkin
ESCENARIO: BDD-1737 - Identificación determinista de formato por bytes mágicos
  DADO un buffer binario que contiene bytes mágicos conocidos (WASM, ELF, PE o ASAR)
  CUANDO se invoca la detección de formato
  ENTONCES se identifica exactamente el tipo de archivo correspondiente
  Y se extraen los metadatos de arquitectura y versión del encabezado
```

### BDD-1738: Electron ASAR Unpacking & File Tree Extraction

```gherkin
ESCENARIO: BDD-1738 - Desempaquetado en memoria de archivos ASAR de Electron
  DADO un buffer binario formateado conforme a la especificación Chromium Pickle/ASAR
  CUANDO se procesa el encabezado y el índice de directorios
  ENTONCES se extrae el árbol completo de archivos virtuales con sus tamaños y offsets
  Y se pueden recuperar los contenidos exactos de cada archivo sin dependencias externas
```

### BDD-1739: Minified JS AST Module Discovery & Symbol Frequency Analysis

```gherkin
ESCENARIO: BDD-1739 - Descubrimiento de módulos y análisis de símbolos en bundles JS
  DADO un código fuente de JavaScript minificado conteniendo módulos empaquetados
  CUANDO se ejecuta la descomposición léxica y de estructura
  ENTONCES se identifican las fronteras de los submódulos empaquetados
  Y se genera una tabla de frecuencia de símbolos e identificadores
```

### BDD-1740: Section Shannon Entropy Calculation & Packed Anomaly Detection

```gherkin
ESCENARIO: BDD-1740 - Cálculo de entropía de Shannon y detección de código empaquetado
  DADO un archivo con secciones de código plano y secciones comprimidas o cifradas
  CUANDO se evalúa la entropía de Shannon por bloque
  ENTONCES las secciones cifradas o comprimidas arrojan una entropía H >= 7.2 bits/byte
  Y son etiquetadas como paquetes ofuscados o empaquetados
```

### BDD-1741: Control-Flow Graph Basic Block DAG Construction

```gherkin
ESCENARIO: BDD-1741 - Construcción del Grafo de Flujo de Control (CFG) por bloques básicos
  DADO una secuencia de instrucciones con saltos condicionales y retornos
  CUANDO se construye el grafo de flujo de control
  ENTONCES cada bloque básico contiene instrucciones secuenciales terminadas en salto o retorno
  Y las aristas representan adecuadamente los caminos de bifurcación y continuación
```

### BDD-1742: CLI Toolchain Parity & Invariant Audit Receipt

```gherkin
ESCENARIO: BDD-1742 - Auditoría integral de ingeniería inversa y emisión de recibo firmado
  DADO el motor de ingeniería inversa configurado con un conjunto de muestras sintéticas
  CUANDO se invoca el comando toolchain:rea:audit
  ENTONCES se valida la detección de formatos, extracción ASAR, cálculo de entropía y CFG
  Y se genera un recibo firmado SHA-256 en docs/evidence/REVERSE_ENGINEERING_RECEIPT.json
```
