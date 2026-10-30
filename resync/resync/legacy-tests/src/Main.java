
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.TreeSet;

public class Main {

    private static int testsPassed = 0;

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError("FAIL: " + message);
        }
        testsPassed++;
    }

    private static void verifyTree(
            SplayTree tree,
            TreeSet<Integer> reference,
            int operationNumber) {

        check(
            tree.isValidBST(),
            "BST invariant at operation " + operationNumber
        );

        List<Integer> actual = tree.getKeysInOrder();
        List<Integer> expected = new ArrayList<>(reference);

        check(
            actual.equals(expected),
            "Key set matches reference at operation " + operationNumber
        );
    }

    public static void main(String[] args) {

        // Test 1: Empty-tree behavior.
        SplayTree tree = new SplayTree();
        TreeSet<Integer> reference = new TreeSet<>();

        check(tree.isEmpty(), "New tree is empty");
        check(!tree.search(10), "Search in empty tree returns false");
        check(!tree.delete(10), "Delete in empty tree returns false");
        verifyTree(tree, reference, 0);

        // Test 2: Integer boundary values.
        tree.insert(Integer.MIN_VALUE);
        reference.add(Integer.MIN_VALUE);

        tree.insert(Integer.MAX_VALUE);
        reference.add(Integer.MAX_VALUE);

        verifyTree(tree, reference, 1);

        check(tree.search(Integer.MIN_VALUE),
                "Minimum integer key can be searched");
        verifyTree(tree, reference, 2);

        check(tree.search(Integer.MAX_VALUE),
                "Maximum integer key can be searched");
        verifyTree(tree, reference, 3);

        check(tree.delete(Integer.MIN_VALUE),
                "Minimum integer key can be deleted");
        reference.remove(Integer.MIN_VALUE);
        verifyTree(tree, reference, 4);

        check(tree.delete(Integer.MAX_VALUE),
                "Maximum integer key can be deleted");
        reference.remove(Integer.MAX_VALUE);
        verifyTree(tree, reference, 5);

        // Test 3: Reproducible randomized operations.
        tree = new SplayTree();
        reference = new TreeSet<>();

        Random random = new Random(42);
        int operationCount = 2000;

        for (int i = 1; i <= operationCount; i++) {
            int key = random.nextInt(301) - 150;
            int operation = random.nextInt(3);

            if(operation == 0){
                // Insert.
                tree.insert(key);
                reference.add(key);

            } else if (operation == 1) {
                // Search.
                boolean actualFound = tree.search(key);
                boolean expectedFound = reference.contains(key);

                check(
                    actualFound == expectedFound,
                    "Search result matches reference at operation " + i
                );

            } else {
                // Delete.
                boolean actualDeleted = tree.delete(key);
                boolean expectedDeleted = reference.remove(key);

                check(
                    actualDeleted == expectedDeleted,
                    "Delete result matches reference at operation " + i
                );
            }

            // Check both properties after EVERY operation.
            verifyTree(tree, reference, i);
        }

        // Test 4: Repeated access to a hot key.
        if (!reference.isEmpty()) {
            int hotKey = reference.first();

            for (int i = 0; i < 100; i++) {
                check(tree.search(hotKey),
                        "Repeated access finds hot key");
                check(
                    tree.getRootKey() == hotKey,
                    "Hot key becomes root"
                );
                verifyTree(tree, reference, operationCount + i + 1);
            }
        }

        System.out.println();
        System.out.println("ALL COMPREHENSIVE TESTS PASSED");
        System.out.println("Assertions passed: " + testsPassed);
        System.out.println("Final tree size: " + reference.size());
    }
}
