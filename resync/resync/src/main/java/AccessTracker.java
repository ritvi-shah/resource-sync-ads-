
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class AccessTracker {

    public static class AccessRecord {
        public final int resourceId;
        public final long accessCount;
        public final Instant lastAccessed;

        public AccessRecord(
                int resourceId,
                long accessCount,
                Instant lastAccessed) {
            this.resourceId = resourceId;
            this.accessCount = accessCount;
            this.lastAccessed = lastAccessed;
        }
    }

    private final Map<Integer, Long> accessCounts = new HashMap<>();
    private final Map<Integer, Instant> lastAccessTimes = new HashMap<>();

    // Most recent resource is at the front.
    private final ArrayDeque<Integer> recentAccesses = new ArrayDeque<>();

    private final int historyLimit;

    public AccessTracker(int historyLimit) {
        if (historyLimit <= 0) {
            throw new IllegalArgumentException(
                    "History limit must be positive");
        }

        this.historyLimit = historyLimit;
    }

    public void recordAccess(int resourceId) {
        recordAccessAt(resourceId, Instant.now());
    }

    // Restores persisted timestamps without changing the bounded-history rules.
    public void recordAccessAt(int resourceId, Instant accessedAt) {
        if (accessedAt == null) {
            throw new IllegalArgumentException("Access timestamp cannot be null");
        }
        accessCounts.merge(resourceId, 1L, Long::sum);
        lastAccessTimes.put(resourceId, accessedAt);

        // Move this resource to the front of the history.
        recentAccesses.remove(resourceId);
        recentAccesses.addFirst(resourceId);

        // Keep only the most recent distinct resource IDs.
        while (recentAccesses.size() > historyLimit) {
            recentAccesses.removeLast();
        }
    }

    public void removeResource(int resourceId) {
        accessCounts.remove(resourceId);
        lastAccessTimes.remove(resourceId);
        recentAccesses.remove(resourceId);
    }

    public long getAccessCount(int resourceId) {
        return accessCounts.getOrDefault(resourceId, 0L);
    }

    public Instant getLastAccessed(int resourceId) {
        return lastAccessTimes.get(resourceId);
    }

    public List<Integer> getRecentAccesses() {
        return new ArrayList<>(recentAccesses);
    }

    public List<AccessRecord> getMostAccessed(int limit) {
        if (limit < 0) {
            throw new IllegalArgumentException(
                    "Limit cannot be negative");
        }

        List<AccessRecord> records = new ArrayList<>();

        for (Map.Entry<Integer, Long> entry
                : accessCounts.entrySet()) {

            records.add(new AccessRecord(
                    entry.getKey(),
                    entry.getValue(),
                    lastAccessTimes.get(entry.getKey())
            ));
        }

        records.sort(
                Comparator.comparingLong(
                        (AccessRecord r) -> r.accessCount
                ).reversed()
                .thenComparing(
                        r -> r.lastAccessed,
                        Comparator.reverseOrder()
                )
        );

        return new ArrayList<>(
                records.subList(0, Math.min(limit, records.size()))
        );
    }
}
