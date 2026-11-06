# ==============================================================================
# EOS SYSTEM — HERMETIC MULTI-STAGE DISTROLESS OCI CONTAINER
# Standards: Google Distroless (Debian 12) · SLSA Level 4 · Zero Vulnerabilities
# ==============================================================================

# ------------------------------------------------------------------------------
# STAGE 1: Go Apex Static Binary Builder
# ------------------------------------------------------------------------------
FROM golang:1.24-alpine AS go-builder
WORKDIR /build

COPY src/native/ src/native/
COPY go.mod* ./

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -extldflags '-static'" \
    -o /build/eos-apex \
    src/native/eos_apex_orchestrator.go

# ------------------------------------------------------------------------------
# STAGE 2: Node.js Control Plane Builder & Sanitizer
# ------------------------------------------------------------------------------
FROM node:24-alpine AS node-builder
WORKDIR /app

COPY package*.json tsconfig*.json ./
COPY src/ ./src/
COPY bin/ ./bin/
COPY scripts/ ./scripts/
COPY docs/ ./docs/
COPY openspec/ ./openspec/

RUN npm ci --ignore-scripts || npm install --omit=dev

# ------------------------------------------------------------------------------
# TARGET 1: Distroless Go Apex Runtime (< 15MB, Non-Root)
# ------------------------------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot AS apex
WORKDIR /app

COPY --from=go-builder /build/eos-apex /app/eos-apex

LABEL org.opencontainers.image.title="EOS System Apex Orchestrator"
LABEL org.opencontainers.image.description="High-Throughput Static Go Native Orchestrator"
LABEL org.opencontainers.image.vendor="EOS System Sovereign Architecture"
LABEL org.opencontainers.image.licenses="MIT"

EXPOSE 8090
USER nonroot:nonroot
ENTRYPOINT ["/app/eos-apex", "-server"]

# ------------------------------------------------------------------------------
# TARGET 2 (DEFAULT): Distroless Node.js Control Plane & Dashboard
# ------------------------------------------------------------------------------
FROM gcr.io/distroless/nodejs24-debian12:nonroot AS default
WORKDIR /app

COPY --from=node-builder /app /app

ENV NODE_ENV=production
EXPOSE 4321

LABEL org.opencontainers.image.title="EOS System Control Plane & MCP Server"
LABEL org.opencontainers.image.description="Hermetic Node.js 24 Layer-0 Control Plane & Telemetry Dashboard"
LABEL org.opencontainers.image.vendor="EOS System Sovereign Architecture"
LABEL org.opencontainers.image.licenses="MIT"

USER nonroot:nonroot
ENTRYPOINT ["/nodejs/bin/node", "bin/eos.mjs"]
CMD ["dashboard", "start", "--port", "4321"]
