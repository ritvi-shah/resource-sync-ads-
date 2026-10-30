
public class ResourceAccessService {

    private final SplayTree tree;
    private final AccessTracker tracker;

    public ResourceAccessService(
            SplayTree tree,
            AccessTracker tracker) {
        this.tree = tree;
        this.tracker = tracker;
    }

    // Access a resource and record the access only if it exists.
    public SplayTree.SearchStats accessResource(int resourceId) {
        return accessResource(resourceId, java.time.Instant.now());
    }

    public SplayTree.SearchStats accessResource(int resourceId, java.time.Instant accessedAt) {
        SplayTree.SearchStats stats = searchResourceWithoutRecording(resourceId);

        if (stats.found) {
            tracker.recordAccessAt(resourceId, accessedAt);
        }

        return stats;
    }

    SplayTree.SearchStats searchResourceWithoutRecording(int resourceId) {
        return tree.searchWithStats(resourceId);
    }

    public long getAccessCount(int resourceId) {
        return tracker.getAccessCount(resourceId);
    }

    public java.util.List<Integer> getRecentAccesses() {
        return tracker.getRecentAccesses();
    }

    public java.util.List<AccessTracker.AccessRecord>
            getMostAccessed(int limit) {
        return tracker.getMostAccessed(limit);
    }

    public Integer getCurrentRoot() {
        return tree.getRootKey();
    }
}
