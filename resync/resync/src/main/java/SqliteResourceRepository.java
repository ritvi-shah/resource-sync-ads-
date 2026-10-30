import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

public class SqliteResourceRepository implements ResourceRepository {
    private static final String RESOURCE_COLUMNS = "r.id, r.title, r.description, r.category, r.resource_type, "
            + "r.subject, r.academic_term, r.resource_url, r.resource_reference, r.tags_json, r.created_at, r.updated_at, r.is_sample, "
            + "(SELECT COUNT(*) FROM resource_attachments a WHERE a.resource_id = r.id) AS attachment_count";
    private static final TypeReference<List<String>> TAG_LIST = new TypeReference<>() {
    };

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public SqliteResourceRepository(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        initializeSchema();
        seedIfEmpty();
    }

    private void initializeSchema() {
        jdbc.execute("CREATE TABLE IF NOT EXISTS resources ("
                + "id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', "
                + "category TEXT NOT NULL, resource_type TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '', "
                + "academic_term TEXT NOT NULL DEFAULT '', resource_url TEXT, resource_reference TEXT NOT NULL DEFAULT '', tags_json TEXT NOT NULL DEFAULT '[]', "
                + "created_at TEXT NOT NULL, updated_at TEXT NOT NULL, is_sample INTEGER NOT NULL DEFAULT 0)");
        ensureResourceReferenceColumn();
        jdbc.execute("CREATE TABLE IF NOT EXISTS access_events ("
                + "event_id INTEGER PRIMARY KEY AUTOINCREMENT, resource_id INTEGER NOT NULL, accessed_at TEXT NOT NULL)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS resource_attachments ("
                + "attachment_id INTEGER PRIMARY KEY AUTOINCREMENT, resource_id INTEGER NOT NULL, storage_key TEXT NOT NULL UNIQUE, "
                + "original_filename TEXT NOT NULL, size_bytes INTEGER NOT NULL CHECK(size_bytes > 0), "
                + "content_type TEXT NOT NULL CHECK(content_type = 'application/pdf'), content_sha256 TEXT NOT NULL DEFAULT '', "
                + "idempotency_key TEXT, uploaded_at TEXT NOT NULL, "
                + "FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE)");
        ensureAttachmentColumns();
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_access_events_resource_time ON access_events(resource_id, accessed_at)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_resource_attachments_resource_time ON resource_attachments(resource_id, uploaded_at, attachment_id)");
        jdbc.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_attachments_idempotency ON resource_attachments(idempotency_key)");
    }

    private void ensureResourceReferenceColumn() {
        List<String> columns = jdbc.query("PRAGMA table_info(resources)", (rs, rowNum) -> rs.getString("name"));
        if (!columns.contains("resource_reference")) {
            jdbc.execute("ALTER TABLE resources ADD COLUMN resource_reference TEXT NOT NULL DEFAULT ''");
        }
    }

    private void ensureAttachmentColumns() {
        List<String> columns = jdbc.query("PRAGMA table_info(resource_attachments)", (rs, rowNum) -> rs.getString("name"));
        if (!columns.contains("content_sha256")) {
            jdbc.execute("ALTER TABLE resource_attachments ADD COLUMN content_sha256 TEXT NOT NULL DEFAULT ''");
        }
        if (!columns.contains("idempotency_key")) {
            jdbc.execute("ALTER TABLE resource_attachments ADD COLUMN idempotency_key TEXT");
        }
    }

    private void seedIfEmpty() {
        if (resourceCount() == 0) {
            for (Resource resource : SampleCatalog.resources()) {
                insert(resource);
            }
        }
    }

    @Override
    public List<ResourceActivity> findPage(
            String query,
            String category,
            String resourceType,
            int offset,
            int limit,
            String sortBy,
            String direction) {
        Filter filter = filter(query, category, resourceType);
        String orderColumn = switch (sortBy == null ? "id" : sortBy) {
            case "title" -> "LOWER(r.title)";
            case "createdAt" -> "r.created_at";
            case "updatedAt" -> "r.updated_at";
            default -> "r.id";
        };
        String orderDirection = "desc".equalsIgnoreCase(direction) ? "DESC" : "ASC";
        String sql = "SELECT " + RESOURCE_COLUMNS + ", COUNT(e.event_id) AS access_count, MAX(e.accessed_at) AS last_accessed "
                + "FROM resources r LEFT JOIN access_events e ON e.resource_id = r.id "
                + filter.whereSql + " GROUP BY r.id ORDER BY " + orderColumn + " " + orderDirection
                + " LIMIT ? OFFSET ?";
        List<Object> args = new ArrayList<>(filter.args);
        args.add(limit);
        args.add(offset);
        return jdbc.query(sql, this::mapActivity, args.toArray());
    }

    @Override
    public long count(String query, String category, String resourceType) {
        Filter filter = filter(query, category, resourceType);
        Long result = jdbc.queryForObject("SELECT COUNT(*) FROM resources r" + filter.whereSql, Long.class, filter.args.toArray());
        return result == null ? 0 : result;
    }

    @Override
    public Optional<Resource> findById(int id) {
        List<Resource> rows = jdbc.query("SELECT " + RESOURCE_COLUMNS + " FROM resources r WHERE r.id = ?", this::mapResource, id);
        return rows.stream().findFirst();
    }

    @Override
    public Optional<ResourceActivity> findActivityById(int id) {
        List<ResourceActivity> rows = jdbc.query(
                "SELECT " + RESOURCE_COLUMNS + ", COUNT(e.event_id) AS access_count, MAX(e.accessed_at) AS last_accessed "
                        + "FROM resources r LEFT JOIN access_events e ON e.resource_id = r.id WHERE r.id = ? GROUP BY r.id",
                this::mapActivity,
                id);
        return rows.stream().findFirst();
    }

    @Override
    public void insert(Resource resource) {
        try {
            jdbc.update("INSERT INTO resources(id,title,description,category,resource_type,subject,academic_term,resource_url,resource_reference,tags_json,created_at,updated_at,is_sample) "
                            + "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    resource.id(), resource.title(), safe(resource.description()), resource.category(), resource.resourceType(),
                    safe(resource.subject()), safe(resource.academicTerm()), resource.resourceUrl(), resource.resourceReference(), encodeTags(resource.tags()),
                    TimeCodec.format(resource.createdAt()), TimeCodec.format(resource.updatedAt()), resource.sample() ? 1 : 0);
        } catch (org.springframework.dao.DataAccessException exception) {
            String message = exception.getMessage();
            if (message != null) {
                String normalized = message.toLowerCase(Locale.ROOT);
                if (normalized.contains("unique constraint failed: resources.id")
                        || normalized.contains("primary key constraint failed")) {
                    throw new DuplicateResourceException(resource.id());
                }
            }
            throw exception;
        }
    }

    @Override
    public boolean update(Resource resource) {
        try {
            int changed = jdbc.update("UPDATE resources SET title=?,description=?,category=?,resource_type=?,subject=?,academic_term=?,resource_url=?,resource_reference=?,tags_json=?,updated_at=?,is_sample=? WHERE id=?",
                    resource.title(), safe(resource.description()), resource.category(), resource.resourceType(), safe(resource.subject()),
                    safe(resource.academicTerm()), resource.resourceUrl(), resource.resourceReference(), encodeTags(resource.tags()), TimeCodec.format(resource.updatedAt()),
                    resource.sample() ? 1 : 0, resource.id());
            return changed > 0;
        } catch (DataIntegrityViolationException exception) {
            throw new IllegalStateException("The resource could not be updated because its data conflicts with the catalog.", exception);
        }
    }

    @Override
    public boolean delete(int id) {
        jdbc.update("DELETE FROM access_events WHERE resource_id = ?", id);
        return jdbc.update("DELETE FROM resources WHERE id = ?", id) > 0;
    }

    @Override
    public long resourceCount() {
        Long result = jdbc.queryForObject("SELECT COUNT(*) FROM resources", Long.class);
        return result == null ? 0 : result;
    }

    @Override
    public long categoryCount() {
        Long result = jdbc.queryForObject("SELECT COUNT(DISTINCT category) FROM resources", Long.class);
        return result == null ? 0 : result;
    }

    @Override
    public long totalAccessCount() {
        Long result = jdbc.queryForObject("SELECT COUNT(*) FROM access_events", Long.class);
        return result == null ? 0 : result;
    }

    @Override
    public long accessCount(int resourceId) {
        Long result = jdbc.queryForObject("SELECT COUNT(*) FROM access_events WHERE resource_id = ?", Long.class, resourceId);
        return result == null ? 0 : result;
    }

    @Override
    public Optional<Instant> lastAccessed(int resourceId) {
        List<String> values = jdbc.query("SELECT MAX(accessed_at) FROM access_events WHERE resource_id = ?", (rs, row) -> rs.getString(1), resourceId);
        return values.isEmpty() || values.getFirst() == null ? Optional.empty() : Optional.of(Instant.parse(values.getFirst()));
    }

    @Override
    public List<ResourceActivity> findPopular(int limit) {
        return jdbc.query("SELECT " + RESOURCE_COLUMNS + ", COUNT(e.event_id) AS access_count, MAX(e.accessed_at) AS last_accessed "
                        + "FROM resources r JOIN access_events e ON e.resource_id = r.id GROUP BY r.id "
                        + "ORDER BY access_count DESC, last_accessed DESC, r.id ASC LIMIT ?",
                this::mapActivity,
                limit);
    }

    @Override
    public Map<Integer, Instant> findLastAccessedFor(List<Integer> resourceIds) {
        if (resourceIds.isEmpty()) {
            return Map.of();
        }
        String placeholders = String.join(",", resourceIds.stream().map(id -> "?").toList());
        Map<Integer, Instant> result = new HashMap<>();
        jdbc.query("SELECT resource_id, MAX(accessed_at) AS last_accessed FROM access_events WHERE resource_id IN ("
                        + placeholders + ") GROUP BY resource_id",
                (org.springframework.jdbc.core.RowCallbackHandler) rs -> {
                    result.put(rs.getInt("resource_id"), parseInstant(rs.getString("last_accessed")));
                },
                resourceIds.toArray());
        return Map.copyOf(result);
    }

    @Override
    public List<AccessEvent> findAllAccessEventsChronologically() {
        return jdbc.query("SELECT resource_id, accessed_at FROM access_events ORDER BY accessed_at ASC, event_id ASC",
                (rs, row) -> new AccessEvent(rs.getInt("resource_id"), Instant.parse(rs.getString("accessed_at"))));
    }

    @Override
    public long insertAccessEvent(int resourceId, Instant accessedAt) {
        Long eventId = jdbc.queryForObject("INSERT INTO access_events(resource_id,accessed_at) VALUES(?,?) RETURNING event_id",
                Long.class, resourceId, TimeCodec.format(accessedAt));
        if (eventId == null) {
            throw new IllegalStateException("The access event was not persisted.");
        }
        return eventId;
    }

    @Override
    public void deleteAccessEvent(long eventId) {
        jdbc.update("DELETE FROM access_events WHERE event_id = ?", eventId);
    }

    private ResourceActivity mapActivity(ResultSet rs, int rowNum) throws SQLException {
        Resource resource = mapResource(rs, rowNum);
        return new ResourceActivity(resource, rs.getLong("access_count"), parseInstant(rs.getString("last_accessed")), rs.getLong("attachment_count"));
    }

    private Resource mapResource(ResultSet rs, int rowNum) throws SQLException {
        return new Resource(
                rs.getInt("id"),
                rs.getString("title"),
                rs.getString("description"),
                rs.getString("category"),
                rs.getString("resource_type"),
                rs.getString("subject"),
                rs.getString("academic_term"),
                rs.getString("resource_url"),
                rs.getString("resource_reference"),
                decodeTags(rs.getString("tags_json")),
                Instant.parse(rs.getString("created_at")),
                Instant.parse(rs.getString("updated_at")),
                rs.getInt("is_sample") != 0);
    }

    private List<String> decodeTags(String json) {
        try {
            List<String> tags = objectMapper.readValue(json == null ? "[]" : json, TAG_LIST);
            return tags == null ? List.of() : List.copyOf(tags);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("The stored resource tags are malformed.", exception);
        }
    }

    private String encodeTags(List<String> tags) {
        try {
            return objectMapper.writeValueAsString(tags == null ? List.of() : tags);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Resource tags could not be encoded.", exception);
        }
    }

    private Filter filter(String query, String category, String resourceType) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (query != null && !query.isBlank()) {
            String term = "%" + query.trim().toLowerCase() + "%";
            where.append(" AND (LOWER(r.title) LIKE ? OR LOWER(r.description) LIKE ? OR LOWER(r.subject) LIKE ? OR LOWER(r.tags_json) LIKE ? OR LOWER(r.resource_reference) LIKE ?)");
            args.add(term);
            args.add(term);
            args.add(term);
            args.add(term);
            args.add(term);
        }
        if (category != null && !category.isBlank()) {
            where.append(" AND LOWER(r.category) = ?");
            args.add(category.trim().toLowerCase());
        }
        if (resourceType != null && !resourceType.isBlank()) {
            where.append(" AND LOWER(r.resource_type) = ?");
            args.add(resourceType.trim().toLowerCase());
        }
        return new Filter(where.toString(), args);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static Instant parseInstant(String value) {
        return value == null ? null : Instant.parse(value);
    }

    private record Filter(String whereSql, List<Object> args) {
    }
}
