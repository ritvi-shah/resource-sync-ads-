
public class MetricsTest {

    public static void main(String[] args) {
        SplayTree tree = new SplayTree();

        int[] keys = {40, 20, 60, 10, 30, 50, 70};

        for (int key : keys) {
            tree.insert(key);
        }

        SplayTree.SearchStats stats = tree.searchWithStats(10);

        System.out.println("Found: " + stats.found);
        System.out.println("Comparisons: " + stats.comparisons);
        System.out.println("Search depth: " + stats.searchDepth);
        System.out.println("Rotations: " + stats.rotations);
        System.out.println("Root after search: " + stats.rootAfterSearch);

        if (!stats.found || stats.rootAfterSearch != 10) {
            throw new AssertionError("Search metrics test failed");
        }

        if (stats.comparisons < 1 || stats.searchDepth < 1) {
            throw new AssertionError("Invalid search metrics");
        }

        if (!tree.isValidBST()) {
            throw new AssertionError("BST invariant violated");
        }

        System.out.println("ALL METRICS TESTS PASSED");
    }
}
