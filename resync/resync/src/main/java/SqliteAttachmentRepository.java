import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public final class SqliteAttachmentRepository implements AttachmentRepository {
    private static final String COLUMNS = "attachment_id, resource_id, storage_key, original_filename, size_bytes, content_type, content_sha256, idempotency_key, uploaded_at";

    private final JdbcTemplate jdbc;

    public SqliteAttachmentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<ResourceAttachment> findByResourceId(int resourceId) {
        return List.copyOf(jdbc.query(
                "SELECT " + COLUMNS + " FROM resource_attachments WHERE resource_id = ? ORDER BY uploaded_at ASC, attachment_id ASC",
                this::map,
                resourceId));
    }

    @Override
    public Optional<ResourceAttachment> findById(int resourceId, int attachmentId) {
        List<ResourceAttachment> rows = jdbc.query(
                "SELECT " + COLUMNS + " FROM resource_attachments WHERE resource_id = ? AND attachment_id = ?",
                this::map,
                resourceId,
                attachmentId);
        return rows.stream().findFirst();
    }

    @Override
    public Optional<ResourceAttachment> findByIdempotencyKey(String idempotencyKey) {
        List<ResourceAttachment> rows = jdbc.query(
                "SELECT " + COLUMNS + " FROM resource_attachments WHERE idempotency_key = ?",
                this::map,
                idempotencyKey);
        return rows.stream().findFirst();
    }

    @Override
    public ResourceAttachment insert(ResourceAttachment attachment) {
        Long id = jdbc.queryForObject(
                "INSERT INTO resource_attachments(resource_id, storage_key, original_filename, size_bytes, content_type, content_sha256, idempotency_key, uploaded_at) "
                        + "VALUES(?,?,?,?,?,?,?,?) RETURNING attachment_id",
                Long.class,
                attachment.resourceId(),
                attachment.storageKey(),
                attachment.originalFilename(),
                attachment.sizeBytes(),
                attachment.contentType(),
                attachment.contentSha256(),
                attachment.idempotencyKey(),
                TimeCodec.format(attachment.uploadedAt()));
        if (id == null) {
            throw new IllegalStateException("The PDF attachment metadata was not persisted.");
        }
        return new ResourceAttachment(
                Math.toIntExact(id),
                attachment.resourceId(),
                attachment.storageKey(),
                attachment.originalFilename(),
                attachment.sizeBytes(),
                attachment.contentType(),
                attachment.contentSha256(),
                attachment.idempotencyKey(),
                attachment.uploadedAt());
    }

    @Override
    public boolean deleteById(int resourceId, int attachmentId) {
        return jdbc.update(
                "DELETE FROM resource_attachments WHERE resource_id = ? AND attachment_id = ?",
                resourceId,
                attachmentId) > 0;
    }

    @Override
    public List<ResourceAttachment> deleteByResourceId(int resourceId) {
        List<ResourceAttachment> existing = findByResourceId(resourceId);
        jdbc.update("DELETE FROM resource_attachments WHERE resource_id = ?", resourceId);
        return existing;
    }

    private ResourceAttachment map(ResultSet rs, int rowNum) throws SQLException {
        return new ResourceAttachment(
                rs.getInt("attachment_id"),
                rs.getInt("resource_id"),
                rs.getString("storage_key"),
                rs.getString("original_filename"),
                rs.getLong("size_bytes"),
                rs.getString("content_type"),
                rs.getString("content_sha256"),
                rs.getString("idempotency_key"),
                Instant.parse(rs.getString("uploaded_at")));
    }
}
