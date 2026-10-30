
public class BenchmarkValidationTest {

    private static final int KEY_COUNT = 1000;

    public static void main(String[] args) {
        testTree(new OrdinaryBST());
        testTree(new AVLTree());
        testTree(new SplayTreeBenchmarkAdapter());

        System.out.println("ALL BENCHMARK VALIDATION TESTS PASSED");
    }

    private static void testTree(BenchmarkTree tree) {
        System.out.println("Testing: " + tree.name());

        // Insert the same keys into every tree.
        for (int key = 1; key <= KEY_COUNT; key++) {
            tree.insert(key);
        }

        if (tree.size() != KEY_COUNT) {
            throw new AssertionError(
                tree.name() + ": incorrect size after insertion"
            );
        }

        // Test every existing key.
        for (int key = 1; key <= KEY_COUNT; key++) {
            SearchResult result = tree.search(key);

            if (!result.found) {
                throw new AssertionError(
                    tree.name() + ": failed to find " + key
                );
            }

            if (result.comparisons <= 0) {
                throw new AssertionError(
                    tree.name() + ": invalid comparison count"
                );
            }

            if (result.searchDepth < 0) {
                throw new AssertionError(
                    tree.name() + ": invalid depth for key " + key
                );
            }
        }

        // Test keys that do not exist.
        int[] missingKeys = {-100, 0, 1001, 2000};

        for (int key : missingKeys) {
            SearchResult result = tree.search(key);

            if (result.found) {
                throw new AssertionError(
                    tree.name() + ": incorrectly found " + key
                );
            }

            if (result.comparisons <= 0) {
                throw new AssertionError(
                    tree.name() + ": missing-key comparisons not counted"
                );
            }
        }

        // Duplicate insertions must not change the size.
        tree.insert(500);
        tree.insert(500);

        if (tree.size() != KEY_COUNT) {
            throw new AssertionError(
                tree.name() + ": duplicate insertion changed size"
            );
        }

        System.out.println(
            "PASS: " + tree.name()
            + " | Height: " + tree.height()
            + " | Size: " + tree.size()
        );
    }
}
