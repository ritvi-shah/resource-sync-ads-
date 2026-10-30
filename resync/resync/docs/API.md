# ResourceSync REST API

Base path: `/api`. Responses use JSON except `DELETE`, which returns 204. No API route records a resource access except `GET /resources/{id}`. Title search, catalog listing, popular/recent, analytics, tree inspection and benchmark report reads are not successful resource-ID accesses.

## Endpoint summary

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/health` | Unauthenticated health response for local and container readiness |
| GET | `/resources` | Paginated catalog; supports `q`, `category`, `type`, `page`, `size`, `sort`, `direction` |
| GET | `/resources/{id}` | Splay Tree-backed resource-ID lookup; on success increments/persists access; missing ID is 404 |
| POST | `/resources` | Create resource; 201 on success; duplicate ID is 409 |
| PUT | `/resources/{id}` | Update existing resource; body ID must equal path ID |
| DELETE | `/resources/{id}` | Delete resource and its access events, then synchronize tree/tracker; 204 |
| GET | `/resources/search?q=...` | SQL title/keyword search plus optional category/type filters; does not splay or count access |
| GET | `/resources/popular?limit=10` | Accessed resources ranked by actual event count |
| GET | `/resources/recent?limit=20` | Recent distinct resource IDs from the bounded AccessTracker history |
| GET | `/analytics/summary` | Resource/category/access totals, tree summary, popular and recent resources |
| GET | `/analytics/benchmarks` | Validated read-only rows from the configured existing CSV, if available |
| GET | `/dsa/splay-tree` | Immutable snapshot of real nodes and parent/child relationships |
| GET | `/dsa/splay-tree/metrics` | Current root/size/height and latest actual ID-search metrics, if any |
| GET | `/attachments/policy` | Effective PDF MIME type, per-request count and maximum file size in bytes |
| GET | `/resources/{resourceId}/attachments` | List persisted PDF metadata for one existing resource; does not access/splay the resource |
| POST | `/resources/{resourceId}/attachments` | Upload one PDF using multipart field `file`; 201 with safe attachment metadata |
| HEAD | `/resources/{resourceId}/attachments/{attachmentId}/content` | Verify that the stored PDF can be served; no body and no resource access event |
| GET | `/resources/{resourceId}/attachments/{attachmentId}/content` | Serve actual PDF bytes with `application/pdf` and inline disposition |
| GET | `/resources/{resourceId}/attachments/{attachmentId}/download` | Download actual PDF bytes with attachment disposition |
| DELETE | `/resources/{resourceId}/attachments/{attachmentId}` | Delete one attachment's metadata and generated file after commit; 204 |

## Resource write body

```json
{
  "id": 1201,
  "title": "Algorithms lecture notes",
  "description": "Course notes for graph algorithms.",
  "category": "Lecture Notes",
  "resourceType": "PDF",
  "subject": "Computer Science",
  "academicTerm": "Year 2 · Semester 1",
  "resourceUrl": "https://example.org/notes.pdf",
  "resourceReference": "library/archive/notes/graph-algorithms.pdf",
  "tags": ["graphs", "algorithms"]
}
```

`id` must be a positive integer. `title`, `category` and `resourceType` are required. Length limits: title 160, description 4000, category/type 80, subject 120, academicTerm 80, URL and opaque resource reference 2048 each, and up to 30 tags of at most 48 characters. URL may be absent; if present it must be an absolute HTTP or HTTPS URL. `resourceReference` is optional opaque metadata (for example, a managed file ID, archive key, or citation); the backend stores and returns it but never treats it as a local path or opens it. Creation and modification timestamps and the sample marker are server-managed. Update request IDs must match the route ID. User-created resources are never marked as sample.

## List and search parameters

`GET /resources` defaults to `page=0`, `size=20`, `sort=id`, `direction=asc`. Page numbering starts at zero; size must be 1–100. Allowed sorts are `id`, `title`, `createdAt` and `updatedAt`; direction is `asc` or `desc`. `q` matches title, description, subject or tags case-insensitively; category and type filters can be combined with it. Filter values are parameterized SQL inputs.

`GET /resources/search` requires a nonblank `q` of at most 160 characters and accepts `category`, `type` and `limit` (default 50, range 1–100). It uses SQL text search, not the ID-indexed Splay Tree.

Every resource view additively includes `attachmentCount`, the number of persisted PDF metadata rows for that resource. Older clients may ignore this field.

## Access/ranking rules

Only a successful `/resources/{id}` lookup is an access. Missing-ID searches do splay the last visited node per the existing tree's semantics and return actual failed-search metrics but do not record an access. Popular ranking is: access count descending, last-access timestamp descending, resource ID ascending. Unaccessed resources do not appear in `/resources/popular`. Recent history is bounded to at most 20 distinct resource IDs, most recent first; a repeated ID moves to the front, rather than adding another recent-list row. Total access frequency is maintained separately from this recent list.

`SearchMetricsView` reports the requested resource ID, found state, actual comparisons, search depth (edges from root; root depth 0), rotations performed by that search, root after search, and timestamp. `TreeSnapshotView` reports actual tree size, height, root ID, last successfully accessed ID, latest search metrics and nodes (`id`, `parentId`, `leftId`, `rightId`, `depth`). Height is `-1` for an empty tree. Snapshot nodes are immutable copies.

## PDF attachments

The PDF feature stores bytes on the server's local filesystem and stores only metadata plus a generated storage key in SQLite. `resourceReference` remains opaque metadata and is never used as a local path. The server generates UUID-based filenames; clients do not supply or receive a storage path.

`GET /attachments/policy` returns the effective frontend/backend limit:

```json
{"maxFileSizeBytes":20971520,"contentType":"application/pdf","maxFilesPerRequest":1}
```

`POST /resources/{resourceId}/attachments` accepts a single multipart file part named `file`. A new upload returns 201:

The optional `Idempotency-Key` header must be a UUID. Clients should generate one stable key per selected file and reuse it for retries; if the header is omitted, the server generates a new key that the client cannot reuse. Replaying the same key for the same resource, sanitized filename, byte size and SHA-256 content returns 200 with the existing attachment metadata and does not create a duplicate. Reusing a key for a different resource or file returns 409 `ATTACHMENT_IDEMPOTENCY_CONFLICT`. If the earlier stored copy is missing or fails its integrity check, an identical replay restores it from the retried bytes.

```json
{
  "id": 1,
  "resourceId": 1201,
  "originalFilename": "algorithms-notes.pdf",
  "sizeBytes": 184233,
  "contentType": "application/pdf",
  "uploadedAt": "2026-10-20T00:00:00Z"
}
```

The metadata response intentionally excludes the generated storage key and filesystem location. `GET /resources/{resourceId}/attachments` returns an array of these objects in upload order. `HEAD` on the `/content` route checks existence/readability before the frontend embeds the PDF. `GET /content` uses inline disposition for the native browser viewer; `/download` uses attachment disposition. A missing database row returns `ATTACHMENT_NOT_FOUND`; a row whose file is missing returns `ATTACHMENT_FILE_MISSING`. Deleting a resource removes all associated metadata in its database transaction and attempts generated-file cleanup after commit. Cleanup failures are logged; a failed cleanup does not return a local path to the client.

Only filenames ending in `.pdf` are accepted, and the backend parses the contents with PDFBox rather than trusting extension or MIME type alone. Empty, malformed or structurally unreadable PDFs are rejected. Each document must contain at least one readable page. Upload, list, HEAD, content, download and attachment deletion do not record resource access or change the Splay Tree. Opening the resource detail page still uses `GET /resources/{id}` and records the actual access.

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `APP_ATTACHMENT_STORAGE_DIR` | `data/attachments` | Local directory for generated PDF bytes |
| `APP_ATTACHMENT_MAX_FILE_SIZE` | `20MB` | Effective per-file limit, also returned by the policy endpoint and used by the multipart parser |
| `APP_ATTACHMENT_MAX_REQUEST_SIZE` | `21MB` | Maximum complete multipart request size; allow overhead above the per-file limit |

Increase both size settings when accepting files larger than the default. Configure `APP_ATTACHMENT_STORAGE_DIR` to a persistent mounted directory for hosted use; the default container filesystem may be ephemeral. No cloud/object storage is implemented.

## Errors

Errors have this shape:

```json
{
  "code": "RESOURCE_NOT_FOUND",
  "message": "Resource 999999 was not found.",
  "details": {"resourceId": "999999"},
  "timestamp": "2026-10-20T00:00:00Z",
  "searchMetrics": {
    "resourceId": 999999,
    "found": false,
    "comparisons": 3,
    "searchDepth": 2,
    "rotations": 1,
    "rootAfterSearch": 7,
    "searchedAt": "2026-10-20T00:00:00Z"
  }
}
```

`searchMetrics` is null when the error is unrelated to an ID lookup. Validation errors, non-positive IDs, malformed numeric query/path parameters, malformed request bodies, and JSON `null` instead of a resource object return 400. Missing resources return 404, duplicate IDs 409, and persistence-unavailable responses 503. Unexpected server errors return a generic 500 response without a stack trace or internal exception text.

Attachment-specific errors use the same JSON shape:

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_ATTACHMENT` | Empty file, unsupported extension/type or malformed/unreadable PDF |
| 400 | `INVALID_MULTIPART_REQUEST` | Multipart request could not be parsed |
| 404 | `ATTACHMENT_NOT_FOUND` | Attachment ID is not associated with the given resource |
| 404 | `ATTACHMENT_FILE_MISSING` | Metadata exists but the generated local file is absent |
| 409 | `ATTACHMENT_IDEMPOTENCY_CONFLICT` | An upload token was reused for a different resource or file |
| 413 | `ATTACHMENT_TOO_LARGE` | Upload exceeds `APP_ATTACHMENT_MAX_FILE_SIZE`; details include `maxFileSizeBytes` |
| 415 | `INVALID_ATTACHMENT_MEDIA_TYPE` | Upload request is not multipart/form-data |
| 503 | `ATTACHMENT_STORAGE_UNAVAILABLE` | Local PDF storage could not complete the operation |

## CORS and report source

CORS applies only to `/api/**`; the allowlist is configurable with `APP_CORS_ALLOWED_ORIGINS`, defaulting to `http://localhost:5173`. `APP_BENCHMARK_REPORT_PATH` selects the server-side report file. Clients cannot supply a path. The CSV must have the known nine-column header and expected workload/tree labels; missing or malformed reports return `available: false` with an empty row list and a safe message.
