import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DsaSnapshotAndPersistenceTest {
    @Test
    void trackerReplaysOriginalTimestampsAndRetainsDistinctBoundedHistory() {
        AccessTracker tracker = new AccessTracker(2);
        Instant first = Instant.parse("2026-01-01T00:00:00Z");
        Instant second = Instant.parse("2026-01-02T00:00:00Z");
        tracker.recordAccessAt(10, first);
        tracker.recordAccessAt(20, second);
        tracker.recordAccessAt(10, Instant.parse("2026-01-03T00:00:00Z"));
        tracker.recordAccessAt(30, Instant.parse("2026-01-04T00:00:00Z"));

        assertEquals(2, tracker.getAccessCount(10));
        assertEquals(List.of(30, 10), tracker.getRecentAccesses());
        assertEquals(Instant.parse("2026-01-03T00:00:00Z"), tracker.getLastAccessed(10));
        tracker.removeResource(10);
        assertEquals(List.of(30), tracker.getRecentAccesses());
        assertEquals(0, tracker.getAccessCount(10));
    }

    @Test
    void treeSnapshotIsAccurateImmutableAndDoesNotRestructureTree() {
        SplayTree tree = new SplayTree();
        tree.insert(20);
        tree.insert(10);
        tree.insert(30);
        tree.search(10);
        Integer rootBefore = tree.getRootKey();
        int heightBefore = tree.height();
        List<Integer> keysBefore = tree.getKeysInOrder();

        SplayTree.TreeSnapshot snapshot = tree.getTreeSnapshot();

        assertEquals(rootBefore, snapshot.rootKey());
        assertEquals(3, snapshot.size());
        assertEquals(heightBefore, snapshot.height());
        assertEquals(keysBefore.size(), snapshot.nodes().size());
        assertTrue(snapshot.nodes().stream().anyMatch(node -> node.key() == 10 && node.parentKey() == null));
        assertEquals(rootBefore, tree.getRootKey());
        assertEquals(keysBefore, tree.getKeysInOrder());
        assertThrows(UnsupportedOperationException.class, () -> snapshot.nodes().add(null));
    }
}
