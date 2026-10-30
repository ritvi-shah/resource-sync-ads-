
public class OrdinaryBSTTest {

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError("FAIL: " + message);
        }
        System.out.println("PASS: " + message);
    }

    public static void main(String[] args) {
        OrdinaryBST tree = new OrdinaryBST();

        check(tree.size() == 0, "Initially empty");

        int[] keys = {40, 20, 60, 10, 30, 50, 70};

        for (int key : keys) {
            tree.insert(key);
        }

        check(tree.size() == 7, "Seven unique keys inserted");
        check(tree.height() == 2, "Balanced example has height two");

        SearchResult found = tree.search(10);

        check(found.found, "Existing key found");
        check(found.comparisons == 3, "Search uses three comparisons");
        check(found.rotations == 0, "Search performs no rotations");

        SearchResult missing = tree.search(99);

        check(!missing.found, "Missing key not found");
        check(missing.rotations == 0, "Missing search has no rotations");

        tree.insert(40);
        check(tree.size() == 7, "Duplicate insertion ignored");

        System.out.println("ALL ORDINARY BST TESTS PASSED");
    }
}
