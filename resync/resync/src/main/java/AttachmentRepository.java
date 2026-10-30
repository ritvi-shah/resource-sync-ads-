import java.util.List;
import java.util.Optional;

public interface AttachmentRepository {
    List<ResourceAttachment> findByResourceId(int resourceId);

    Optional<ResourceAttachment> findById(int resourceId, int attachmentId);

    Optional<ResourceAttachment> findByIdempotencyKey(String idempotencyKey);

    ResourceAttachment insert(ResourceAttachment attachment);

    boolean deleteById(int resourceId, int attachmentId);

    List<ResourceAttachment> deleteByResourceId(int resourceId);
}
