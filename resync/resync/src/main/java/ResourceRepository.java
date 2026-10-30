import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface ResourceRepository {
    record ResourceActivity(Resource resource, long accessCount, Instant lastAccessed, long attachmentCount) {
    }

    record AccessEvent(int resourceId, Instant accessedAt) {
    }

    List<ResourceActivity> findPage(
            String query,
            String category,
            String resourceType,
            int offset,
            int limit,
            String sortBy,
            String direction);

    long count(String query, String category, String resourceType);

    Optional<Resource> findById(int id);

    Optional<ResourceActivity> findActivityById(int id);

    void insert(Resource resource);

    boolean update(Resource resource);

    boolean delete(int id);

    long resourceCount();

    long categoryCount();

    long totalAccessCount();

    long accessCount(int resourceId);

    Optional<Instant> lastAccessed(int resourceId);

    List<ResourceActivity> findPopular(int limit);

    Map<Integer, Instant> findLastAccessedFor(List<Integer> resourceIds);

    List<AccessEvent> findAllAccessEventsChronologically();

    long insertAccessEvent(int resourceId, Instant accessedAt);

    void deleteAccessEvent(long eventId);
}
