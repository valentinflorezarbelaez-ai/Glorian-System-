# Glorian Fleet Edge Gateway — Distroless production image
# Build: docker build -t glorian-gateway .
FROM golang:1.23-alpine AS builder
WORKDIR /src
COPY go.mod .
COPY main.go .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /glorian-gateway .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /glorian-gateway /glorian-gateway
COPY docs/projects/registry.json /etc/glorian/registry.json
EXPOSE 8090
USER nonroot:nonroot
ENTRYPOINT ["/glorian-gateway", "--fleet", "/etc/glorian/registry.json"]
