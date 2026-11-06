# PLAN-137: Architecture Plan & ADR — Glorian Millennium Sovereign Elevation

## 1. Architectural Drivers & Context
- Sincronización completa de la identidad de marca Glorian System en todos los artefactos públicos.
- Materialización en disco de la persistencia física del log WAL bitemporal con fsync por hardware.
- Elevación del Studio Console para monitoreo de la flota de 9 proyectos y Tribunal Constitucional.
- Alcance del hito de 1.000 transacciones inmutables encadenadas con Merkle Mountain Range.

## 2. Architecture Decision Records (ADRs)

### ADR-078: Canonical Landing URL Standardization
- **Decision**: Estandarizar `https://glorian-system.vercel.app/` en `index.html` (reemplazando cualquier remanente de `eos-system.vercel.app`).
- **Consequences**: Consistencia total con el registro de flota (`registry.json`) y con los enlaces en el portafolio oficial.

### ADR-079: Hardware-Grade WAL Physical Persistence
- **Decision**: Utilizar `EosDurableWal` de `src/core/eosDurableWal.ts` para crear `data/eos_bitemporal.wal`, garantizando formato binario `EOSW_BINARY_V1`, checksum IEEE 802.3 CRC32 y fsyncSync antes de retornar el estado nominal.
- **Consequences**: Cero riesgo de escrituras partidas ("torn writes") en caso de reinicio forzado del sistema operativo.

### ADR-080: Millennium Sovereign Seal (Tx #1.000)
- **Decision**: Registrar de forma secuencial las transacciones faltantes (#999 y #1.000) en `.eos/state/eos_sovereign_ledger.sqlite` sellando la raíz del Merkle Mountain Range (MMR).
- **Consequences**: Proporciona pruebas de inclusión y exclusión `O(log N)` criptográficamente demostrables para todo el historial operativo de Glorian.
