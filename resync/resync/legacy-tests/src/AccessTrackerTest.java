
public class AccessTrackerTest {

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError("FAIL: " + message);
        }

        System.out.println("PASS: " + message);
    }

    public static void main(String[] args) {
        AccessTracker tracker = new AccessTracker(3);

        tracker.recordAccess(10);
        tracker.recordAccess(20);
        tracker.recordAccess(10);
        tracker.recordAccess(30);
        tracker.recordAccess(40);

        check(tracker.getAccessCount(10) == 2,
                "Frequency of resource 10 is correct");

        check(tracker.getAccessCount(20) == 1,
                "Frequency of resource 20 is correct");

        check(tracker.getAccessCount(999) == 0,
                "Unaccessed resource has frequency zero");

        check(tracker.getRecentAccesses().equals(
                        java.util.List.of(40, 30, 10)),
                "Recent history is ordered and bounded");

        check(tracker.getLastAccessed(10) != null,
                "Last-access timestamp is recorded");

        check(tracker.getMostAccessed(1).get(0).resourceId == 10,
                "Most-accessed resource is ranked correctly");

        check(tracker.getMostAccessed(10).size() == 4,
                "Ranking returns all accessed resources when limit is large");

        check(tracker.getMostAccessed(0).isEmpty(),
                "Zero ranking limit returns an empty list");

        System.out.println("ALL ACCESS TRACKER TESTS PASSED");
    }
}
