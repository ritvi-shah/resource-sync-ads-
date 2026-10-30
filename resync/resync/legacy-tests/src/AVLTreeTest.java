
public class AVLTreeTest {

    public static void main(String[] args) {
        AVLTree tree = new AVLTree();

        // Test 1: Empty tree.
        if (tree.size() != 0 || tree.height() != -1) {
            throw new AssertionError("Empty tree test failed");
        }

        // Test 2: Sorted insertions should still produce
        // a balanced tree.
        for (int i = 1; i <= 1000; i++) {
            tree.insert(i);
        }

        if (tree.size() != 1000) {
            throw new AssertionError("Incorrect tree size");
        }

        if (!tree.isValidAVL()) {
            throw new AssertionError(
                "AVL invariant failed after sorted insertions"
            );
        }

        if (tree.height() >= 20) {
            throw new AssertionError(
                "Tree is unexpectedly tall: " + tree.height()
            );
        }

        // Test 3: Duplicate insertion must not increase size.
        tree.insert(500);

        if (tree.size() != 1000) {
            throw new AssertionError(
                "Duplicate insertion changed the size"
            );
        }

        // Test 4: Search for an existing key.
        SearchResult found = tree.search(500);

        if (!found.found) {
            throw new AssertionError(
                "Existing key was not found"
            );
        }

        if (found.comparisons <= 0) {
            throw new AssertionError(
                "Search comparisons were not counted"
            );
        }

        if (found.rotations != 0) {
            throw new AssertionError(
                "AVL search should not rotate the tree"
            );
        }

        // Test 5: Search for a missing key.
        SearchResult missing = tree.search(2000);

        if (missing.found) {
            throw new AssertionError(
                "Missing key was incorrectly found"
            );
        }

        // Test 6: Check the tree remains valid.
        if (!tree.isValidAVL()) {
            throw new AssertionError(
                "AVL invariant failed after searches"
            );
        }

        System.out.println("Tree name: " + tree.name());
        System.out.println("Tree size: " + tree.size());
        System.out.println("Tree height: " + tree.height());
        System.out.println("Search comparisons: " + found.comparisons);
        System.out.println("Search depth: " + found.searchDepth);
        System.out.println("ALL AVL TREE TESTS PASSED");
    }
}
