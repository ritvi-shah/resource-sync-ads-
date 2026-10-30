
public class StressTest {

    public static void main(String[] args) {
        final int N = 1000;
        SplayTree tree = new SplayTree();

        System.out.println("Inserting " + N + " sequential keys...");

        for (int i = 1; i <= N; i++) {
            tree.insert(i);
        }

        if (!tree.isValidBST()) {
            throw new AssertionError("BST invalid after insertion");
        }

        System.out.println("Insertion test passed.");
        System.out.println("Root after insertion: " + tree.getRootKey());

        System.out.println("Accessing keys in reverse order...");

        for (int i = N; i >= 1; i--) {
            if (!tree.search(i)) {
                throw new AssertionError("Key not found: " + i);
            }

            if (tree.getRootKey() != i) {
                throw new AssertionError("Incorrect root for key: " + i);
            }
        }

        if (!tree.isValidBST()) {
            throw new AssertionError("BST invalid after reverse access");
        }

        System.out.println("Reverse access test passed.");
        System.out.println("Final root: " + tree.getRootKey());
        System.out.println("ALL STRESS TESTS PASSED");
    }
}
