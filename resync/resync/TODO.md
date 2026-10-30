# Phase 1 Outcomes — Smart Frequently Accessed Content Manager

## [x] 1. Preserve and integrate the existing Java DSA project

- Inspect the existing source tree, Java version, build configuration and public APIs.
- Determine whether a build tool is already configured.
- Identify the existing resource-access workflow and persistence limitations.
- Inspect existing tests and determine how to run them.
- Preserve all unrelated work and existing functioning code.
- Do not assume the file structure or method signatures without checking them.
- Do not recreate the Splay Tree, access tracker or resource-access service from scratch. Reuse the existing implementations.
- Preserve existing Java implementations and benchmark functionality, including `SplayTree.java`, `AccessTracker.java`, `ResourceAccessService.java`, `SearchResult.java`, `BenchmarkTree.java`, `OrdinaryBST.java`, `AVLTree.java`, `SplayTreeBenchmarkAdapter.java`, `SplayTreeTimingAdapter.java`, `BenchmarkRunner.java`, `BenchmarkReport.java`, and the existing DSA/access-tracking/resource-service/benchmark test classes.
- Keep all existing source and benchmark artifacts in the supplied archive intact. If the source files are not accessible, request the project files or repository instead of fabricating an integration.
- Use Java with a compatible Spring Boot version, Spring Web, Spring Validation, SQLite with a compatible JDBC driver and a lightweight persistence approach, JUnit and the existing testing framework where applicable. Use Maven if the project does not already have a build system; if one exists, preserve it unless a change is necessary and justified.
- Do not introduce a frontend framework, a separate JavaScript resource engine, unnecessary microservices, or a complicated deployment architecture.
- Keep the backend suitable for a local demonstration and later web deployment.

**Evidence:** The supplied archive remains unmodified; its Java sources and original main-method test harnesses are copied into the repository. The existing default-package APIs are preserved; the Spring backend reuses the real Splay Tree, AccessTracker and ResourceAccessService with explicit Spring bean wiring. The packaged Spring Boot JAR builds successfully.

## [x] 2. Implement resource management and SQLite persistence

- Create a resource model supporting unique integer ID, title, description, category, resource type, subject or department, academic year or semester where relevant, URL or resource reference, tags where useful, and creation/modification timestamps.
- Implement endpoints for listing resources with pagination; retrieving a resource by ID; creating, updating and deleting a resource; searching by title or keyword; and filtering by category and resource type.
- Validate required fields, reject duplicate IDs, handle invalid URLs appropriately, and return meaningful HTTP status codes.
- Use realistic sample campus materials such as lecture notes, assignments, laboratory manuals, timetables, examination notices and reference materials.
- Seed a small, clearly identifiable sample catalog for local demonstration. Do not fabricate official university documents or real institutional links. Do not make sample data overwrite existing user data during startup.
- Separate existing DSA classes, resource domain models, repository/persistence layer, application services, REST controllers, request/response DTOs, exception handling and automated tests.
- The database stores resource metadata and persistent access history; the Splay Tree is used for resource-ID lookup and is not the permanent database.
- Avoid unnecessary abstractions. Keep the architecture straightforward and explainable during a university viva.

**Evidence:** Spring/JUnit tests exercise resource CRUD, duplicate IDs, invalid data, filters, safe HTTP(S) URLs and opaque-reference round trips. SQLite tests verify restart persistence, precise timestamp ordering and in-place migration of an existing schema without losing rows. The running JAR seeds exactly seven samples only when the catalog is empty.

## [x] 3. Integrate real Splay Tree lookup, access tracking, and tree data

- Integrate the existing Splay Tree through the existing `ResourceAccessService` and `AccessTracker` wherever their APIs support the required behavior.
- A resource-ID lookup validates the requested ID, uses the real Java Splay Tree-based lookup workflow, returns actual resource metadata, records the access, updates the actual access tracker, persists the access history, and returns useful search/access information to the frontend.
- Handle missing resources and missing IDs correctly.
- Ensure create, update and delete operations keep the in-memory tree synchronized with the resource catalog.
- Reconstruct the in-memory Splay Tree from persisted resource IDs when the application starts or reloads data.
- Do not fabricate search comparisons, rotation counts, tree height or root values. If the existing service API needs an extension, make the smallest justified change and add tests.
- Expose total resource count, total recorded accesses, per-resource access count, most frequently accessed resources, recent resource accesses, last-accessed timestamp, Splay Tree size and height, and available search metrics.
- Keep frequency ranking separate from Splay Tree ordering. A Splay Tree does not automatically sort resources by access frequency.
- Define ranking and tie-breaking rules consistently.
- Use persistent access history so recorded activity can survive application restarts. If existing bounded recent-history behavior must be preserved, use an appropriate persistence design without silently changing tested tracker semantics.
- Avoid counting unrelated operations such as listing all resources as successful resource-ID accesses unless that behavior is explicitly designed and documented.
- Provide a read-only API representation of the actual Splay Tree, including node resource IDs, parent-child relationships, root node, tree size, tree height, last accessed node where available, and latest search metrics where available. Use a dedicated response DTO; do not expose mutable internal nodes. If the Splay Tree lacks safe read-only structure access, add the smallest suitable non-mutating traversal method and test that visualization data corresponds to the actual tree.

**Evidence:** Integration and live API checks verify real comparisons/depth/rotations/root, frequency and recent activity, CRUD/tree synchronization, failed searches, restart reconstruction and actual immutable tree snapshots. A stale tree key with no DB record returns 404 without changing access totals. The existing `ResourceAccessService` success-only behavior remains compatible with all original tests.

## [x] 4. Provide the REST API contract and safe behavior

- Use a consistent base path such as `/api` and provide/document routes equivalent to:
  - `GET /api/health`
  - `GET /api/resources`
  - `GET /api/resources/{id}`
  - `POST /api/resources`
  - `PUT /api/resources/{id}`
  - `DELETE /api/resources/{id}`
  - `GET /api/resources/search?q=...`
  - `GET /api/resources/popular`
  - `GET /api/resources/recent`
  - `GET /api/analytics/summary`
  - `GET /api/analytics/benchmarks`
  - `GET /api/dsa/splay-tree`
  - `GET /api/dsa/splay-tree/metrics`
- Adjust endpoint details only if the existing service design requires it, keep the final API consistent, and document the actual routes.
- Use appropriate HTTP methods/status codes, request validation, response DTOs and centralized error handling for invalid input (including malformed scalar parameters, non-positive IDs and JSON `null` resource bodies), missing resources, duplicate IDs, persistence failures and unexpected server errors.
- Enable CORS for the anticipated local React development origin with a clearly configurable allowlist. Do not use unrestricted CORS as a substitute for configuration.

**Evidence:** `docs/API.md` documents the implemented routes and response/error shapes. MockMvc and final packaged-runtime checks verify 400 for malformed numeric parameters, non-positive IDs and JSON-null bodies; 404 for missing resources; 409 for duplicates; and 503 mapping for persistence failures. The final JAR and `/manus-routes.json` were checked on port 3000.

## [x] 5. Preserve benchmark compatibility without contaminating normal access

- Preserve the existing benchmark implementation and its CSV reporting. It compares Ordinary BST, AVL Tree and Splay Tree across random searches, repeated hot-key searches, mixed campus access and Zipf-like popularity, and produces `out/benchmark-results.csv`.
- Do not run a full benchmark automatically on every backend startup.
- Do not let normal resource access corrupt the benchmark's independently measured results.
- Do not fabricate analytics values or claim that the Splay Tree is faster than AVL in all scenarios.
- For Phase 1, preserve existing benchmark artifacts and expose existing report data safely if straightforward. Full frontend benchmark visualization belongs to Phase 2.

**Evidence:** The original CSV and benchmark code are preserved. The read-only endpoint reports the supplied 12 rows and requires exactly one unique row per one of four workloads by three trees; missing, malformed, incomplete and duplicate matrices return a safe unavailable state. Original benchmark regression tests pass.

## [x] 6. Verify behavior, regression safety, and persistence

- Run the existing Java regression tests using their actual available commands.
- Add focused backend tests for the health endpoint; resource CRUD; duplicate IDs; invalid resource data; existing and missing resource lookup; Splay Tree integration; access-frequency updates; recent activity; popular-resource ranking; tree visualization accuracy; database persistence across restart; tree synchronization after resource creation and deletion; and consistent error responses.
- Do not claim tests passed unless they were actually executed and verified. Report any unavailable tooling or remaining limitations honestly.

**Evidence:** Final `mvn -B clean package` passed all 15 tests with zero failures/errors. `./scripts/run-regression-tests.sh` passed all ten original Java harnesses, including 5,779 comprehensive assertions. Live API exercises covered CRUD, lookup/count updates, recent/popular results, missing IDs, 12 benchmark rows, and persistence/tree restoration across a backend process restart. Docker CLI was unavailable, so the container image itself was not built locally; the packaged JAR launch and health route were verified.

## [x] 7. Document Phase 1 setup and its deployment boundary

- Document the Java/Maven requirements, configuration/environment variables, local setup/start instructions, exact API contract, data-store location, sample-data behavior, CORS allowlist, benchmark-report status and test commands.
- Keep generated artifacts and temporary files out of the repository; include appropriate `.gitignore` entries.
- Do not build the frontend, graphical tree visualization, dashboard, or full benchmark analytics UI in this phase. These belong to later phases.
- Document that local SQLite persistence depends on the configured data file/path. A hosted Webdev container filesystem is ephemeral; do not represent its file as durable across replacement/restarts without a persistent volume or durable database.

**Evidence:** `README.md`, `docs/API.md`, `plan.md`, `Dockerfile` and environment properties describe setup, behavior and storage limits. No frontend/UI was built. The Webdev container health contract is stored, and auto-publication remains disabled.


# Phase 2 Outcomes — Frontend and Integration

## [x] 8. Preserve the Phase 1 backend, database, benchmark artifact, and runtime contract

- Continue the existing Smart Frequently Accessed Content Manager project; do not initialize a replacement project or overwrite the working implementation.
- Preserve Phase 1 completely. Do not overwrite or reset either existing SQLite database, modify or regenerate the existing benchmark CSV, replace the Java DSA implementation, remove or weaken any existing Java or regression tests, or delete original project work.
- Keep the existing Java 21 + Spring Boot API, SQLite persistence and API response/error contract functional. Make only the approved additive, backward-compatible attachment schema/API and `attachmentCount` response-field changes; do not change existing resource metadata/URL semantics or DSA behavior.
- Use separate temporary SQLite databases and temporary filesystem storage directories for all attachment tests and real-browser integration writes. Do not run test mutations against either protected project database or change the supplied benchmark CSV.
- Keep the backend's existing default port (`PORT` override or default 3000), existing `application.properties` values/defaults, Webdev `runtime.port=3000`, `/api/health`, existing API-only Dockerfile and deployment contract unchanged. Add only the approved attachment-storage and maximum-file-size settings. When Vite occupies Preview port 3000, a documented per-process `PORT=8080` override may run the Spring backend on 8080; configure Vite's `/api` proxy to that listener, and document both startup commands. Do not silently change the backend's configured/default port or break direct API access.
- Keep any future frontend-in-Spring/single-container embedding strictly optional and separate from the default backend packaging/development workflow. Do not add an SPA fallback or embed the frontend by default in this phase.
- Do not publish or deploy the application.

**Final evidence:** The original Java DSA implementations, existing resource/API behavior, application defaults, and backend-only Dockerfile remain intact. The two supplied/project SQLite files and benchmark CSV were compared by SHA-256 before packaging; the final ZIP contains the unchanged supplied database and CSV. Maven and real-browser tests wrote only to isolated `target/` databases and storage directories. The real same-origin browser upload initially exposed an `Origin` header/CORS proxy issue, which was corrected in Vite without broadening backend CORS.

## [x] 9. Build the complete screenshot-guided, accessible web application shell and navigation

- Use React, TypeScript, Vite, Recharts, a consistent icon/component library where useful, React Router or an equivalent lightweight router, a centralized Fetch/light HTTP client, and maintainable reusable CSS/design tokens. Keep project code organized and readable.
- Use the supplied dashboard screenshot as inspiration for compact persistent desktop navigation, layout, spacing and information hierarchy without copying its ERP branding/content. The product must feel like a polished academic productivity application, not a generic AI dashboard.
- Use a light warm-neutral background, restrained accents, professional readable typography, consistent spacing/alignment/borders/control sizes, compact resource rows/tables, readable data-dense analysis, subtle shadows and interactions, laptop/tablet/phone layouts, accessible contrast and visible keyboard focus. Use the approved restrained warm-neutral and campus-teal direction.
- Avoid excessive rounded cards, gradients/glassmorphism, oversized headings, needless whitespace, random accent colors, emoji navigation, excessive pills, decorative charts without analytical value, fake activity/notifications/statistics, and dead or decorative buttons.
- Implement clear navigation with working Dashboard, Resource Library, Popular Resources, Recent Resources, DSA Visualization and Benchmark Analytics pages, visible active-navigation states and consistent page layouts. Do not create placeholder pages to fill navigation.
- Support semantic labelled controls, keyboard interaction and focus, responsive navigation, bounded scroll regions for wide tables/trees, and reduced-motion behavior. Every visible navigation item and major control must lead to a working action.

**Evidence:** Six primary navigation pages, detail/create/edit/delete flows and the responsive shell are implemented. `/manus-routes.json` returned HTTP 200 with all nine actual route patterns. Chromium checks at 390px and 768px were visually inspected: navigation remains usable and benchmark charts stack with concise labels and visible bars; no unintended horizontal overflow was found. Controls use semantic labels and focus states; reduced-motion handling is present and chart entrance motion is disabled.

## [x] 10. Implement mandatory name-based resource discovery and real ID-backed access

- Normal users must search for and open resources by name; they must never need to know, copy or manually enter an internal resource ID. The internal ID is an implementation detail for the backend.
- Search the catalogue using `GET /api/resources/search?q=...`. Support supported metadata including title, description, subject and tags, case-insensitive/partial matching where the backend supports it, clear-search, a loading state, useful empty state, error feedback/retry, labelled keyboard interaction, and short debounce or explicit submission rather than uncontrolled requests on every keystroke.
- Display meaningful result data from actual responses: title, description, subject, category, resource type, semester/academic term, tags and URL/reference only where available. Do not fabricate absent metadata.
- Allow a user to select a result by its title or row. Obtain its ID from the selected backend result in code and call `GET /api/resources/{id}` through the existing Java resource-access workflow. Never ask the user to enter that ID in ordinary discovery.
- On successful lookup, show actual resource details and any available safe external URL; refresh actual Splay Tree visualization and related access metrics. Handle missing/failed lookups with the backend response and do not count a failed lookup as a successful resource access.
- Keep metadata catalogue search separate from adaptive ID lookup. Do not claim the Splay Tree performs full-text search or count ordinary browse/list/search/filter/analytics reads as accesses.
- The only manual-ID input is a small, clearly labelled optional `DSA Demonstration` control on the educational DSA page.

**Evidence:** Vitest covers metadata search by name without exposing IDs, selection passes the returned ID programmatically, and detail opens call the access API; tree and metrics refetch after successful access. The isolated real-backend/browser flow verified access counts, recent data, root change and the actual Java snapshot; a missing demonstration ID returns 404 without incrementing successful accesses. Manual ID entry remains only in the DSA Demonstration panel.

## [x] 11. Complete the live-data Dashboard

- Build the Dashboard using real data from `GET /api/analytics/summary` and only metrics supported by its response.
- Show actual total resource records, total recorded successful accesses, category count, popular/recent resources and Splay Tree size/height/latest available search metrics. Show category distribution only if the API provides sufficient real data; do not derive or invent unsupported values.
- Include a prominent resource search entry point and allow direct opening of popular and recent resources by selecting their names.
- Use compact visualizations only where they add meaningful information. Do not invent historical trends, growth percentages, unique-user counts or time-series data unsupported by the backend.
- Clearly distinguish live application analytics from the separate supplied benchmark report.

**Evidence:** Dashboard tests use the `AnalyticsSummary` response shape and render returned counts/popular/recent resources. Dashboard hooks fetch `/api/analytics/summary`; no historical trends or unsupported totals are fabricated, and benchmark data is labeled separately.

## [x] 12. Build the paginated Resource Library, complete details, and working metadata CRUD

- Browse using `GET /api/resources`; metadata search may use `GET /api/resources/search?q=...`. Implement backend-supported pagination (`page`, `size`), filters (`q`, `category`, `type`) and sorting (`id`, `title`, `createdAt`, `updatedAt`; `asc`/`desc`). Do not repeatedly fetch the entire catalogue when server pagination is available.
- Support title and supported metadata search, category filters, resource-type filters, supported metadata filters, clear-all-filters, loading/error/empty states and navigation to resource details. There is no dedicated subject filter; only expose filters that the backend really supports.
- Resource details show the complete available title, description, category, resource type, subject, tags, URL/reference fields, timestamps, sample marker, access count and last-accessed information as returned by the API. If a valid external `resourceUrl` exists, provide a clearly labelled safe external-open action; if it does not, explain that the record has no linked document. Do not imply metadata is an uploaded document.
- Create via `POST /api/resources`. Build the form from the actual DTO: positive integer ID; required title, category and resource type; optional description, subject, academic term, HTTP(S) URL, opaque resource reference and tags. Apply backend limits: title 160 characters; description 4000; category/resource type 80 each; subject 120; academic term 80; URL and reference 2048 each; at most 30 tags, each at most 48 characters. Validate absolute HTTP(S) URLs, show field-level validation, prevent duplicate submission, and preserve useful entered values on failure.
- Edit via `PUT /api/resources/{id}`. Preserve existing values when opening the edit form; use the selected record ID programmatically and handle validation/API errors.
- Delete via `DELETE /api/resources/{id}` and require confirmation first. On successful create/update/delete, refresh affected lists, detail, popularity/recency and dashboard metrics; handle duplicate/not-found/persistence failures accurately.
- Keep sample records clearly identifiable; do not imply they are official university documents or links. PDF attachment upload/viewing is now in scope under outcomes 17–20. Do not add unsupported non-PDF uploads, simulated files or claims that an external URL/resource reference is an uploaded document.

**Final evidence:** Vitest covers filters, pagination, create/edit/delete, validations and errors. In the isolated real-browser flow, a uniquely named temporary record was created and deleted; the original seven catalogue records remained. The Library search filtered the existing resource by title and opened it by clicking its name. Editing with a selected PDF left the attachment list unchanged until metadata save, then uploaded the staged file.

## [x] 13. Implement honest Popular and Recent Resources pages

- Use `GET /api/resources/popular` for popular data and display the actual recorded access-frequency ranking with resource name and returned metadata/frequency.
- Clearly label that frequency measures recorded access events; never interpret them as distinct users or invent a popularity score. When multiple resources have equal frequency, do not invent a meaningful ranking distinction.
- Use `GET /api/resources/recent` for recent data according to the backend's existing bounded recent-access behavior. Show title and available metadata, allow opening by resource name, and refresh after relevant successful accesses.
- Do not confuse the number of recent distinct resource records with the number of users or total accesses. Preserve the backend's bounded distinct-ID semantics.

**Evidence:** Popular and Recent pages use their dedicated endpoints and nested response DTOs; tests verify recorded-event and bounded-distinct-resource semantics. Backend tests verify ranking/tie-breaking and bounded recent-history behavior.

## [x] 14. Render the actual Java Splay Tree and teach its role accurately

- Use `GET /api/dsa/splay-tree`, `GET /api/dsa/splay-tree/metrics`, and the selected-resource `GET /api/resources/{id}` workflow. Inspect and render the real returned snapshot; do not implement another tree or simulate data.
- Draw the returned nodes and parent-child connections. Identify current root; display tree size and height; show node keys and associated resource information when available; show latest real search result and all supplied comparisons, search depth, rotations and other metrics.
- Refresh tree and metrics after successful resource access; handle empty trees and unavailable metrics; make larger trees navigable without overflowing the page. Keep normal interaction resource-name-based; include the manual ID input only in the small, clearly labelled DSA Demonstration control.
- Add a concise educational explanation of what a Splay Tree is; how splaying moves an accessed node toward the root; why repeated accesses may benefit from adaptive restructuring; why a Splay Tree does not guarantee every lookup is faster than AVL; and how this application's real Java tree is used.
- If the backend exposes only a limited snapshot or no rotation-by-rotation history, show only actual information and do not fabricate animation steps or claim the static diagram is a historical replay.

**Evidence:** The DSA page consumes returned node/link snapshots and metrics from `/api/dsa/splay-tree` endpoints. The selection flow verifies successful ID-backed access and an updated server root/snapshot. The original Java algorithms and all 10 regression harnesses were preserved and passed.

## [x] 15. Build the dedicated Benchmark Analytics page from the existing validated report

- Use `GET /api/analytics/benchmarks` and only its supplied validated report. Compare Ordinary BST, AVL Tree and Splay Tree across Random searches, Repeated hot-key searches, Mixed campus access and Zipf-like popularity.
- Compare all three structures in each workload. Visualize median elapsed time using the report's documented `medianSearchTimeMs` milliseconds; also visualize average comparisons and other available metrics, including depth, rotations/search, resource/search counts and height.
- Use clear axes, units, legends, labels and informative tooltips. Allow the user to select a workload or compare workloads in an organized layout. Explain each workload. Provide a precise data table alongside/below the charts; distinguish elapsed time from algorithmic comparison counts.
- Handle unavailable or malformed data gracefully. Do not run arbitrary new benchmarks from the browser, invent missing measurements, silently transform units, substitute made-up data or overwrite the original CSV. Keep this benchmark report separate from live access analytics.
- Display measured results honestly even when AVL outperforms Splay. Explain: an ordinary BST can become unbalanced; AVL maintains height balance; and Splay adapts through rotations. Never state Splay always performs best.

**Evidence:** Analytics reads the existing validated report; the live response contained 12 rows for four workloads by three tree implementations. Recharts charts and the exact-values table use supplied milliseconds, comparisons and other report metrics. Chromium checks at 390px and 768px showed the real bars. Tests cover units, workload explanations and unavailable-report behavior without fabricated fallback data. The supplied CSV was not modified.

## [x] 16. Centralize API types/errors, validate responsive behavior, and complete the Phase 2 handover

- Create one centralized typed API client reflecting the actual backend request/response DTOs; do not scatter raw fetch calls or hardcoded service URLs across components. Support same-origin Preview requests and configurable `VITE_API_BASE_URL`, with documented local default `http://localhost:3000/api`.
- Handle loading/pending states, network failure, malformed/unexpected responses, HTTP 400 validation, 404 not-found, 409 duplicate, 503 persistence failure and unexpected server errors. Show concise understandable messages and never expose stack traces. Prevent duplicate writes, preserve form input after failures, and avoid repeated requests on every component render. Do not record successful access for ordinary catalogue browsing/search.
- Keep the UI responsive on laptop, tablet and smaller screens; ensure accessible color contrast, semantic controls, labels, keyboard behavior, visible focus, and reduced-motion support. Wide tables and tree views must remain contained/navigable.
- Add meaningful frontend tests for: Dashboard loading from the real API DTO; name/keyword search; search empty/error states; pagination/filters; opening by selecting a title; programmatic internal-ID use; successful/unsuccessful access; create/edit/delete; form validation; popular/recent rendering; API-shaped tree rendering; tree/metric refresh after successful lookup; benchmark data mapping/units; navigation and responsive layout. Run frontend tests/build; rerun existing Java regression tests without changing Java algorithm behavior or weakening tests. Where possible, run real backend integration checks with an isolated temporary SQLite database. Report any test that cannot run.
- Update the README with required Java, Maven, Node.js and package-manager versions; installation; backend and Vite startup commands; API base URL configuration; implemented routes; name-based search to ID-based Java Splay Tree access; frontend/backend test commands; PDF storage configuration, API endpoints and size limit; and known limitations. Explicitly document that this uses the existing Java Splay Tree; catalogue search differs from adaptive ID access; authentication is not implemented; only PDF attachments use the configurable local filesystem; non-PDF uploads, community uploads and cloud storage are not implemented; local SQLite/filesystem persistence differs from hosted durable storage; and frontend embedding into a future single-container build is optional and is not performed by default.
- At handover, report files created/modified; pages and workflows; endpoints used; build/test results; exact run commands; and remaining issues/incomplete work. Correctness, real functionality and maintainability take priority over decoration.

**Final evidence:** From a clean extraction of the ZIP, `mvn -B test` passed 20 tests, frontend typecheck passed, Vitest passed 29 tests in five files, `pnpm run build` succeeded, and all ten original Java regression harnesses passed (5,779 assertions). The extracted project installed frontend dependencies with `pnpm install --frozen-lockfile`. Documentation and the final ZIP were verified; browser checks covered the requested real-backend workflows.


## [x] 17. Additive PDF attachment metadata, filesystem storage and resource lifecycle

- A resource must support one or multiple actual PDF documents stored and served by the application. Store file metadata and the resource relationship in SQLite; do not store document bytes in resource metadata fields or use `resourceReference` as a filesystem path.
- Add a `resource_attachments` table containing attachment ID, resource ID, generated internal storage name, sanitized original filename, byte size, `application/pdf` content type and upload timestamp. Create it additively with `CREATE TABLE IF NOT EXISTS` or an equivalent compatible migration. Do not reset, recreate or overwrite existing databases or resource records. Existing resources with zero attachments continue to work normally.
- Store bytes on the local filesystem beneath configurable `APP_ATTACHMENT_STORAGE_DIR`, default `data/attachments`. Generate independent UUID-based storage names and constrain every resolved file path to that directory. Never return or accept a filesystem path from the browser.
- Add `GET /api/attachments/policy` to return the effective maximum file size in bytes. Add `POST /api/resources/{resourceId}/attachments` accepting one multipart `file`; `GET /api/resources/{resourceId}/attachments`; `GET /api/resources/{resourceId}/attachments/{attachmentId}/content` for inline PDF viewing; `GET /api/resources/{resourceId}/attachments/{attachmentId}/download`; and `DELETE /api/resources/{resourceId}/attachments/{attachmentId}`. List responses include original filename, byte size, content type and upload timestamp, but not the generated storage path.
- Serve actual PDF bytes with `application/pdf` and appropriate inline disposition for viewing; provide a distinct attachment disposition for downloads. Keep existing resource URLs and metadata APIs compatible. Add the `attachmentCount` response field additively and ensure it reflects persisted attachments.
- Constrain upload, list, serve, download and delete operations to existing resources and their attachment IDs. Deleting one attachment leaves its resource and other attachments intact. Resource deletion removes attachment metadata transactionally and generated files safely after database commit; clean up newly written files if upload persistence fails. Avoid orphaned files where practical and document how post-commit cleanup failures are handled.

## [x] 18. Integrate multi-PDF management and actual in-app viewing across resource workflows

- Update the Resource Library to show each resource's actual attachment count while retaining name-based selection and existing pagination/filter/sort behavior.
- Update resource details to list all attached PDFs with original filename and size, allow a user to select and open each, embed the actual selected PDF in an in-app viewer, and allow switching among multiple PDFs without losing the resource context. Provide download and open-in-new-tab actions, an informative empty state, and graceful loading/missing-file errors. Preserve existing metadata, Splay Tree lookup metrics, edit and delete actions.
- Add a functional PDF attachment control to Create/Edit workflows. Allow multiple PDF selections and upload sequentially. Show per-file and overall progress and clearly identify success and failure for each file. Do not simulate uploads or present hardcoded examples as real attachments.
- If resource metadata creation succeeds but one or more selected PDF uploads fail, preserve the resource and every successful attachment, navigate to that resource's details page, and allow retrying the failed files without duplicating successful files. Keep existing metadata intact when adding or removing attachments.
- Allow a PDF attachment to be removed independently; require appropriate confirmation and update only attachment state. Keep the ordinary resource workflow name-based; never require users to enter an internal resource ID manually.
- Opening the resource through the existing successful detail/access workflow records the real access and updates the actual Java Splay Tree. Searching and switching among PDF attachments must not create false successful lookups or increment access counts.

## [x] 19. Validate PDF contents, enforce limits and return safe attachment errors

- Support PDF files only. Set a configurable 20 MiB default maximum per file through `APP_ATTACHMENT_MAX_FILE_SIZE`; enforce the effective limit in Spring multipart handling and the backend service, and use the value returned by `/api/attachments/policy` for frontend checks.
- Validate that file content is a structurally readable PDF using PDFBox; do not trust the file extension alone. Reject unsupported extensions/types and malformed PDF content with clear messages. Sanitize original filenames for safe display and `Content-Disposition`, and never derive filesystem paths from client input.
- Prevent path traversal, ensure generated file access remains within the configured directory, do not execute uploaded files, do not expose arbitrary filesystem paths, and never open an arbitrary `resourceReference` as a local file.
- Handle oversized uploads, malformed PDFs, missing resources, missing attachment IDs/files and storage failures using the existing structured API error shape without leaking stack traces or filesystem locations.

## [x] 20. Verify PDF persistence/viewing, update documentation and preserve the existing project

- Add backend and frontend tests for uploading one PDF and multiple PDFs; listing, inline serving, download and independent deletion; invalid/oversized uploads; missing files and attachment IDs; preserving resource metadata and existing database records; safely deleting a resource and cleaning its attachment files; and opening the PDF viewer from the name-based resource workflow.
- Use separate temporary SQLite databases and temporary filesystem storage directories for all tests and real-browser integration writes. Do not modify the protected project databases or benchmark report.
- Run the frontend typecheck, tests and production build; run backend Maven tests and all original Java regression harnesses without changing or weakening DSA algorithms/tests. Start the application and verify that a real valid uploaded PDF opens successfully in the browser's in-app viewer before declaring this feature complete.
- Update `README.md` and `docs/API.md` with storage-directory configuration, file-size limit, attachment endpoints, multipart field, startup commands, test commands, and local versus hosted persistent-storage considerations. Keep authentication, community uploads, cloud storage and desktop conversion out of scope. Do not publish or deploy the application.
- Provide the changed-file summary, test results, exact verification/startup steps and any outstanding limitations.
- Add a `resource_attachments` table containing attachment ID, resource ID, generated internal storage name, sanitized original filename, byte size, `application/pdf` content type, content SHA-256, unique upload idempotency key and upload timestamp. Create it additively with `CREATE TABLE IF NOT EXISTS` and safe migration of any prior attachment-table version. Do not reset, recreate or overwrite existing databases or resource records. Existing resources with zero attachments continue to work normally.
- Add `GET /api/attachments/policy` to return the effective maximum file size in bytes. Add `POST /api/resources/{resourceId}/attachments` accepting one multipart `file` and optional UUID `Idempotency-Key`; `GET /api/resources/{resourceId}/attachments`; `GET /api/resources/{resourceId}/attachments/{attachmentId}/content` for inline PDF viewing; `GET /api/resources/{resourceId}/attachments/{attachmentId}/download`; and `DELETE /api/resources/{resourceId}/attachments/{attachmentId}`. List responses include original filename, byte size, content type and upload timestamp, but not the generated storage path. An identical retry with the same token returns the existing metadata without storing a duplicate; reusing a token for a different resource/name/content returns 409.
- If resource metadata creation succeeds but one or more selected PDF uploads fail, preserve the resource and every successful attachment, navigate to that resource's details page, and allow retrying only the failed files without duplicating successful files, including when the server stored a file but its response was lost. Reuse a stable per-file idempotency key on retry. Keep existing metadata intact when adding or removing attachments.
- Add backend and frontend tests for uploading one PDF and multiple PDFs; listing, inline serving, download and independent deletion; identical idempotent replay without a second metadata row or file, and a 409 for a token reused with different content; invalid/oversized uploads; missing files and attachment IDs; preserving resource metadata and existing database records; safely deleting a resource and cleaning its attachment files; and opening the PDF viewer from the name-based resource workflow.


**Final evidence for outcomes 17–20:** The additive SQLite attachment schema and UUID/SHA-256 idempotency implementation passed backend integration coverage, including identical replay, conflict, metadata/list/content/download/delete, cleanup, oversize parser handling, malformed PDFs, and missing stored files. The actual browser flow used two valid one-page PDFs on an isolated SQLite copy: both uploaded sequentially, the first opened in-app, the second selected and rendered, a download was verified as a valid PDF, and one attachment was independently deleted. After restarting Spring with the same temporary database and file directory, the resource and remaining PDF reopened successfully. A one-shot browser network failure produced a retryable entry; retry succeeded without a duplicate. Searching and switching PDFs did not add resource accesses; opening the resource by its title did. The final ZIP passed archive integrity and fresh extraction, contained the complete 99-file source/configuration set plus the unchanged SQLite database and benchmark CSV, and excluded `target/`, `node_modules/`, test files, local attachment storage, environment secrets and build output. The clean extracted copy installed locked frontend dependencies and passed Maven, frontend, regression and production-build checks. Local PDF files under `data/attachments` remain outside the archive and are documented in `README.md`.

## [x] 21. Apply the approved ResourceSync visual system and cover create-with-PDF integration

- Use the user's supplied ResourceSync mockup as the visual reference: deep charcoal and near-black backgrounds, layered graphite surfaces, restrained turquoise/cyan accents, refined sans-serif typography, thin separators, clean rows and rectangular controls.
- Restyle all existing routes and states consistently without changing routes, page hierarchy, section order, navigation items/destinations, data/API behavior, Splay Tree or benchmark logic. Keep genuine charts, tree visualizations and PDF controls readable, responsive and accessible.
- Remove/reduce decorative icons, excessive pills, repeated rounded cards and unnecessary glows. Preserve icons only where they support navigation or a real control. Use the supplied metallic/cyan artwork only as a restrained accent inside the existing dashboard discovery section; do not add or reorder page sections.
- Investigate the reported create-with-PDF and multiple-attachment symptoms in the current form, upload client, API and backend/schema before changing them. Keep metadata creation before uploads, preserve selected files on metadata failure, upload every selected PDF sequentially against the returned ID, report each result, retain successes after partial failure, and retry only failed entries with the same idempotency token. A resource must retain multiple independently manageable attachments.
- Add form-level regression coverage for creation with one PDF, multiple PDFs, metadata failure without premature upload, and partial upload failure/navigation with retryable failed files. Continue covering detail-page multi-upload, counts and independent deletion with the existing suite.
- Verify desktop and mobile visual states, preserve keyboard/focus/contrast behavior, rerun backend tests, Java regressions, frontend tests/typecheck/build, and perform isolated browser verification of the visual and PDF flows. Update README/design notes and provide an updated ZIP when supported; exclude caches, secrets, and temporary test artifacts.


**Completion evidence for outcome 21:** The app now uses the supplied ResourceSync visual direction and cropped metallic accent while preserving existing routes, navigation, content order, API behavior, DSA and benchmark calculations. The creation workflow audit found metadata-save-before-upload and sequential retry behavior already present; no backend change was required. New form tests cover one PDF, multiple sequential PDFs with partial failure/retry, and metadata failure retaining staged files without premature upload. Real-browser checks covered the dashboard, form, resource detail/PDF viewer, benchmarks and Splay Tree at desktop width, plus the form at a 390 px viewport. Two PDFs were staged before save, uploaded sequentially to the generated resource ID, switched in the viewer, confirmed as valid bytes after restarting Spring against the same isolated database and file directory, and one was removed independently while the other remained. The exact updated ZIP passed fresh-extraction checks: Maven 20/20, frontend typecheck plus 32/32 tests and production build, and all 10 original Java regression harnesses. The original SQLite database and benchmark CSV hashes match the source ZIP; generated, secret and local test files are excluded.
