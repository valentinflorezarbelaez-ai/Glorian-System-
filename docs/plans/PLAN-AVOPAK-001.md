# PLAN-AVOPAK-001: HEXAGONAL ARCHITECTURE PLAN & DECISION RECORDS

## 1. Governance & Owner Approval
- **Plan ID**: `PLAN-AVOPAK-001`
- **Spec Reference**: `SPEC-122`
- **Project ID**: `control-de-asistencia-abopack`
- **Owner Approval Status**: `OWNER_APPROVAL` GRANTED (Explicit owner mandate by Valentín Flórez Arbeláez on `2026-11-01` to build and deploy `CONTROL DE ASISTENCIA AVO-PAK` with EOS perfection).

---

## 2. Clean / Hexagonal Layer Topology

```text
C:\Users\valen\Control-De-Asistencia-Abopack\
├── src/
│   ├── domain/                        # 100% Pure Layer-0 Core (Zero DOM, HTTP, or framework imports)
│   │   ├── avopakDataset.mjs          # Official 44 personnel roster, 16 plant areas, schedules & admin profiles
│   │   ├── colombianLaborEngine.mjs   # 42h/week calculator, 40m meal deduction, 8:00 PM HED/HEN splitter, permits & absences
│   │   └── attendanceStore.mjs        # Pure immutable state reducer for weekly attendance, QR scans, RBAC & photo evidence
│   ├── application/                   # Pure Use-Case Orchestration
│   │   ├── excelReportBuilder.mjs     # Multi-sheet Excel (.xlsx) schema & RFC-4180 CSV builder with formula-injection guard
│   │   └── hoursQueryAssistant.mjs    # Interactive employee hours & Colombian payroll query engine
│   ├── infrastructure/                # Ports & Adapters
│   │   └── storageAdapter.mjs         # Multi-week localStorage/IndexedDB persistence adapter with snapshot backup
│   ├── vendor/                        # Self-hosted zero-CDN browser utilities
│   │   ├── qrcode.js                  # ISO/IEC 18004 QR code generator for printable badges
│   │   ├── jsQR.js                    # Real-time camera frame QR decoder
│   │   └── write-excel-file.min.js    # Native OpenXML .xlsx binary generator
│   └── ui/                            # Accessible Executive & Industrial UI Layer (WCAG 2.1 AA)
│       └── main.mjs                   # Reactive controller (Weekly Sheet, Group/Individual Editor, QR Terminal, Permits, RBAC)
├── api/                               # Vercel Node.js 24 Serverless Functions
│   └── health.mjs                     # GET /api/health (CNCF health probe & Colombian labor engine status)
├── css/
│   └── styles.css                     # Avo Pak Industrial Design System (#587e50, #dfd57c, Dark/Light, @media print QR badges)
├── scripts/
│   └── verify-strict.mjs              # 7-Stage Fail-Closed SecDevOps & SDD Verification Gate
├── test/
│   └── avopak.test.mjs                # Native node:test suite covering BDD-335..BDD-341
├── index.html                         # Semantic HTML5 SPA + Printable QR Sheet + Executive Dashboard
├── manifest.webmanifest               # Installable PWA manifest for plant tablets & gate smartphones
├── sw.js                              # Offline-capable Service Worker
├── package.json                       # Zero runtime npm dependencies (dependencies: {})
└── vercel.json                        # CSP, camera=(self) permissions policy, HSTS & routing
```

---

## 3. Architecture Decision Records (ADRs)

### ADR-AVP-001: Chronological Minute-by-Minute Splicer for 42-Hour Weekly Limit & 8:00 PM Night Differential
- **Status**: `ACCEPTED`
- **Context**: In a food processing plant with rotating day and night shifts (`07:00-14:40` up to `20:00-03:40`), simply summing weekly hours and subtracting 42 fails to determine whether the overtime hours occurred before 8:00 PM (`Horas Extras Diurnas`) or after 8:00 PM (`Horas Extras Nocturnas`).
- **Decision**: Implement a chronological minute-by-minute work interval evaluator in `colombianLaborEngine.mjs`. As each day's net worked intervals (with the 40-minute meal break carved out) are accumulated from Monday through Sunday, the exact minute where the worker crosses `2,520 minutes` (`42.0 hours`) transitions subsequent minutes into Overtime, classifying each minute against the `20:00` (8:00 PM) to `06:00` (6:00 AM) night boundary.
- **Rejected Alternatives**:
  - *Aggregate weekly subtraction without timestamp awareness*: Rejected — cannot distinguish daytime vs. post-8:00 PM nighttime overtime.
