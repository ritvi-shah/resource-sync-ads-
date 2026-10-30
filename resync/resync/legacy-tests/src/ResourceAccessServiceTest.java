
public class ResourceAccessServiceTest {

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError("FAIL: " + message);
        }
        System.out.println("PASS: " + message);
    }

    public static void main(String[] args) {
        SplayTree tree = new SplayTree();

        int[] resources = {10, 20, 30, 40, 50};

        for (int resource : resources) {
            tree.insert(resource);
        }

        AccessTracker tracker = new AccessTracker(5);

        ResourceAccessService service =
                new ResourceAccessService(tree, tracker);

        // Access the same resource repeatedly.
        service.accessResource(20);
        service.accessResource(30);
        service.accessResource(20);
        service.accessResource(40);
        service.accessResource(20);

        check(service.getAccessCount(20) == 3,
                "Repeated access updates frequency");

        check(service.getAccessCount(30) == 1,
                "Other resource frequency is tracked");

        check(service.getRecentAccesses().equals(
                        java.util.List.of(20, 40, 30)),
                "Recent history is in correct order");

        check(service.getMostAccessed(1).get(0).resourceId == 20,
                "Most frequently accessed resource is ranked first");

        check(service.getCurrentRoot() == 20,
                "Last successful access becomes the tree root");

        // Missing resource must not count as a successful access.
        SplayTree.SearchStats missing =
                service.accessResource(999);

        check(!missing.found,
                "Missing resource is reported as not found");

        check(service.getAccessCount(999) == 0,
                "Missing resource does not increase access frequency");

        check(tree.isValidBST(),
                "BST invariant remains valid after service operations");

        System.out.println("ALL SERVICE INTEGRATION TESTS PASSED");
    }
}
