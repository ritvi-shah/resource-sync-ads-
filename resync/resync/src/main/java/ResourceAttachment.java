import java.time.Instant;

public record ResourceAttachment(
        int id,
        int resourceId,
        String storageKey,
        String originalFilename,
        long sizeBytes,
        String contentType,
        String contentSha256,
        String idempotencyKey,
        Instant uploadedAt) {
}
