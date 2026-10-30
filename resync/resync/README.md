# ResourceSync — Smart Frequently Accessed Content Manager

ResourceSync is a two-phase academic resource workspace. Phase 1 is the Java/Spring REST backend; Phase 2 adds the React + TypeScript web interface and persisted PDF attachments. The supplied Splay Tree, AccessTracker, ordinary BST, AVL tree, benchmark code and regression harnesses remain in Java. The frontend displays real API data and never simulates the tree.

The frontend uses the supplied dark ResourceSync mockup as its visual reference: graphite surfaces, soft-white editorial typography, restrained turquoise highlights, thin separators and square-edged controls. The mockup's metallic artwork is cropped from the supplied project image and used as a quiet accent inside the existing dashboard discovery panel. Existing routes, navigation order, page sections, API integrations and data behavior are unchanged.

## Phase 2 interface and routes

The web app provides a dashboard, Resource Library, Popular Resources, Recent Resources, Splay Tree visualization and Benchmark Analytics, plus resource detail/create/edit/delete flows. Resource records can have one or more actual PDF attachments; the Library shows their persisted count, details embed the selected stored PDF in the browser's native viewer, and Create/Edit provide sequential uploads, progress, retry and independent removal. Search is by title, subject, description and supported tags; selecting a result opens it through the backend's ID-based access endpoint. The ID is generated internally for new records and is not requested in ordinary search or CRUD. Manual IDs are limited to the clearly labeled DSA Demonstration panel.

The implemented routes are `/`, `/resources`, `/resources/new`, `/resources/:id`, `/resources/:id/edit`, `/popular`, `/recent`, `/dsa` and `/benchmarks`; the Vite Preview/site route manifest is `frontend/public/manus-routes.json` and is served at `/manus-routes.json` from the frontend origin. The Spring listener remains API-only; its Phase 1 static manifest is intentionally empty and is not the UI route manifest.

The tree diagram is drawn from the Java backend's actual immutable node snapshot, parent/child links and metrics. Charts and the exact-values table use the read-only benchmark report endpoint. Benchmark measurements remain separate from live access analytics. Demonstration records are inserted by the backend only when the catalogue is empty and remain clearly labeled as samples, not official university documents.

## Requirements

- Java 21 JDK and Maven 3.8+
- Node.js 22.13.0 and pnpm 11.25.0 (the frontend package pins pnpm 11.25.0)

## Run locally

Start Spring Boot in terminal 1 from the repository root. For Vite development, override the listener for this process only; `application.properties` and the default backend port remain unchanged. By default this command uses the existing `data/smart-content-manager.db`.

```bash
PORT=8080 mvn spring-boot:run
```

In terminal 2, start the React app:

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Open the app at `http://localhost:3000`. Vite proxies relative `/api` requests to `http://127.0.0.1:8080`, so the same API client works in the managed Preview and in local development. The browser API base defaults to `/api` (which resolves to `http://localhost:3000/api` in local Vite); optionally set `VITE_API_BASE_URL` to override it. Keep it same-origin in Preview. For local overrides, copy `.env.example` to `.env.local`. If Spring runs elsewhere, set `BACKEND_PROXY_TARGET` for the Vite process (for example `BACKEND_PROXY_TARGET=http://127.0.0.1:8081 pnpm dev`). Do not set a `VITE_` prefix on this proxy target; it is a server-side setting, not a browser secret/config value.

To run a separate local test/demo backend without writing to the existing project database, use a new database path:

```bash
APP_DB_PATH=target/phase2-demo.db PORT=8080 mvn spring-boot:run
```

The backend still listens on `http://localhost:3000` when `PORT` is unset. `PORT` is a per-process override, not a change to the existing default. Other backend environment variables are documented below.

## Backend storage and data preservation

The SQLite database defaults to `data/smart-content-manager.db`; its parent is created automatically. Startup does not replace existing rows. The attachment schema is created additively; existing resource rows and demonstration records remain intact. PDF bytes default to `data/attachments` on the local filesystem; SQLite stores only attachment metadata and generated storage keys. Seven clearly labeled demonstration records are inserted only when the resource catalogue is empty. The UI does not seed or hardcode live records. The active project database, the database contained in the supplied ZIP, and `out/benchmark-results.csv` are preserved. Frontend unit tests use mocked HTTP; attachment integration tests use `target/test-data/attachment-api.db` and `target/test-data/attachment-api-files`, separate from protected data.

The final source ZIP includes the existing `data/smart-content-manager.db` file unchanged and the supplied `out/benchmark-results.csv`. Local PDF bytes under `data/attachments` are intentionally not packaged; back up or copy that directory separately if it contains documents you need. Temporary test/browser databases and test PDFs are stored under `target/` and are excluded from the ZIP. The additive attachment schema migration runs when the backend starts.

Resource records may store an optional absolute HTTP(S) URL and a separate opaque reference string. `resourceReference` is metadata only and is never treated as a file path. PDF uploads are parsed by PDFBox, limited to the configured size and stored under generated UUID filenames; the API never accepts or returns a filesystem path. Only PDF attachments are supported. Authentication, multi-user community features, non-PDF uploads, cloud storage and desktop functionality are intentionally out of scope.

Useful backend environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Spring HTTP listener |
| `APP_DB_PATH` | `data/smart-content-manager.db` | SQLite database file |
| `APP_CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Allowed browser origins for `/api/**` |
| `APP_ACCESS_HISTORY_LIMIT` | `20` | Maximum distinct IDs in the bounded recent-history view |
| `APP_BENCHMARK_REPORT_PATH` | `out/benchmark-results.csv` | Read-only benchmark CSV path |
| `APP_ATTACHMENT_STORAGE_DIR` | `data/attachments` | Local directory for generated PDF files; use a persistent mounted directory in hosted use |
| `APP_ATTACHMENT_MAX_FILE_SIZE` | `20MB` | Maximum size of one PDF; returned by `GET /api/attachments/policy` and enforced by the backend and multipart parser |
| `APP_ATTACHMENT_MAX_REQUEST_SIZE` | `21MB` | Spring multipart request limit, allowing room for one PDF plus multipart overhead; raise it when increasing the file limit |

## API and behavior

The exact REST contract, DTOs, sorting, validation, access side effects, popularity ranking and error format are in [docs/API.md](docs/API.md). The health check is `GET /api/health`.

`GET /api/resources/{id}` searches the existing Java Splay Tree and records one persisted event only when the resource exists. It returns the actual comparison/depth/rotation/root metrics. Missing IDs include real failed-search metrics and do not increment counts. Name search, listing, filters, analytics, benchmark retrieval and edits do not record a new access unless the detail route is explicitly opened.

Resource search returns matching metadata; opening a title in the detail route performs one counted access. The edit form uses selected catalogue state or resolves a direct edit URL by paging the non-counting list endpoint sorted by ID, so editing metadata does not create an extra Splay Tree access.

Popular ranking uses access count descending, last-access time descending, then resource ID ascending. Recent history follows AccessTracker's bounded list of distinct resource IDs, most recent first; it is not one row per event. Access events restore counts, timestamps and recency on backend restart.

Attachment listing, upload, PDF switching/viewing, download and deletion are not successful resource lookups and do not update access counts or the Splay Tree. Opening the resource detail page still uses the existing ID-based workflow and records one actual access. Resource deletion removes its attachment metadata transactionally and attempts to remove generated files after commit; filesystem cleanup failures are logged, while storage paths are never returned to clients.

## Tests and builds

From the repository root:

```bash
mvn test
bash scripts/run-regression-tests.sh
```

The Maven suite covers REST CRUD/validation, lookup semantics, popularity/recency, tree snapshots, benchmark validation, SQLite persistence/migration and attachment upload/list/serve/download/delete, PDF validation, size limits, idempotent replay/conflict, multipart-parser error details, missing-file handling, isolated filesystem cleanup and access invariance. The original main-method regression harnesses are `Main`, `StressTest`, `MetricsTest`, `AccessTrackerTest`, `ResourceAccessServiceTest`, `OrdinaryBSTTest`, `AVLTreeTest`, `BenchmarkValidationTest`, `ZipfWorkloadTest` and `BenchmarkReportTest`. The last writes its test output to `out/benchmark-report-test.csv`, not the supplied benchmark report.

From `frontend/`:

```bash
pnpm run typecheck
pnpm test
pnpm run build
```

Frontend tests use mocked HTTP responses; create-form coverage includes one/multiple PDFs, metadata failure, partial upload failure and retryable navigation state. Backend integration/persistence tests use isolated SQLite files. The frontend is served by Vite on port 3000 and the API by Spring on port 8080 during development. The build can be split by route; Recharts is loaded only on the Benchmark Analytics route.

## Benchmarks and deployment boundary

`GET /api/analytics/benchmarks` validates and reads the supplied CSV without running benchmarks during startup or ordinary access. It requires exactly one row for each of four synthetic workloads by three tree implementations. Values are shown as returned; median time is milliseconds and may vary. AVL may outperform Splay, so no universal speed claim is made.

The existing `Dockerfile` remains backend-only; embedding the frontend is intentionally optional and is not part of this development setup. Both SQLite and the default local attachment directory are ordinary filesystem paths; hosted container disks may be ephemeral, so configure `APP_DB_PATH` and `APP_ATTACHMENT_STORAGE_DIR` to persistent mounted storage before any public production use. No cloud/object storage is implemented. The application has not been published or deployed. No Docker image build is claimed unless separately verified.
