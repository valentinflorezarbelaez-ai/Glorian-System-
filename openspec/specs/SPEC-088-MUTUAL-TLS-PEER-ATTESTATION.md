# SPEC-088: CLOUDFLARE ZERO-TRUST MTLS PEER CHANNEL & SPIFFE ATTESTATION MESH

## 1. Specification Metadata
- **Spec ID**: `SPEC-088`
- **Change**: `CHANGE-064`
- **Status**: `APPROVED`
- **Standard**: IEEE 830 / ISO 29148, EOS Formal EARS & BDD Standard
- **Milestone**: Version `72.0.0`
- **Author**: Valentín Flórez Arbeláez (Principal Architect)

---

## 2. Functional Requirements (Formal EARS Syntax)

### FR-314: Pure Layer-0 Ephemeral Certificate Authority & Keypair Generation
- **Pattern (Ubiquitous / Permanent)**: EL SISTEMA generará pares de claves criptográficas seguras (RSA-2048 o Ed25519) y certificados X.509 autofirmados en memoria utilizando exclusivamente `node:crypto`, sin binarios externos de OpenSSL ni dependencias npm.

### FR-315: Mutual TLS (mTLS) Socket Negotiation
- **Pattern (Event-Driven)**: CUANDO dos nodos `EosTlsPeerTransport` se conecten, EL SISTEMA requerirá que tanto el cliente como el servidor presenten certificados válidos (`requestCert: true, rejectUnauthorized: true`), garantizando cifrado en tránsito TLS 1.3 de extremo a extremo.

### FR-316: SPIFFE Identity URI SAN Verification
- **Pattern (State-Driven)**: MIENTRAS se valide el handshake TLS, EL SISTEMA extraerá y verificará que el Subject Alternative Name (SAN) del certificado coincida con el formato de identidad estándar `spiffe://eos.system/node/<nodeId>` correspondiente al nodo emisor.

### FR-317: Fail-Closed Untrusted Peer Rejection
- **Pattern (Error / Unwanted Condition)**: SI un par se conecta sin certificado, con un certificado emitido por una CA ajena o con una identidad SPIFFE no autorizada, ENTONCES EL SISTEMA cerrará inmediatamente la conexión a nivel de socket sin procesar ningún frame y registrará un evento de seguridad.

---

## 3. Acceptance Criteria (BDD Gherkin Standard)

```gherkin
ESCENARIO: BDD-251: Negociación exitosa de canal mTLS bidireccional con identidad SPIFFE
  DADO dos nodos EosTlsPeerTransport con certificados mTLS válidos
  CUANDO el nodo A se conecta al nodo B sobre TLS 1.3
  ENTONCES la conexión se establece de forma segura y autenticada
  Y ambos nodos verifican las identidades SPIFFE recíprocas exitosamente.

ESCENARIO: BDD-252: Rechazo fail-closed de pares con certificados manipulados o no confiables
  DADO un nodo EosTlsPeerTransport en escucha segura
  CUANDO un cliente se conecta con un certificado autofirmado por una CA desconocida
  ENTONCES el servidor rechaza el handshake TLS inmediatamente
  Y ningún frame de aplicación es procesado.
```
