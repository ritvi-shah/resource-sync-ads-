
public class AVLTree implements BenchmarkTree {

    private static class Node {
        int key;
        int height;
        Node left;
        Node right;

        Node(int key) {
            this.key = key;
            this.height = 0; // A leaf has height 0.
        }
    }

    private Node root;
    private int size;

    // Null nodes have height -1.
    private int nodeHeight(Node node) {
        return node == null ? -1 : node.height;
    }

    private void updateHeight(Node node) {
        node.height = 1 + Math.max(
            nodeHeight(node.left),
            nodeHeight(node.right)
        );
    }

    // Positive: left-heavy. Negative: right-heavy.
    private int balanceFactor(Node node) {
        if (node == null) {
            return 0;
        }

        return nodeHeight(node.left) - nodeHeight(node.right);
    }

    // Right rotation.
    private Node rotateRight(Node y) {
        Node x = y.left;
        Node middle = x.right;

        x.right = y;
        y.left = middle;

        // Update the lower node first.
        updateHeight(y);
        updateHeight(x);

        return x;
    }

    // Left rotation.
    private Node rotateLeft(Node x) {
        Node y = x.right;
        Node middle = y.left;

        y.left = x;
        x.right = middle;

        updateHeight(x);
        updateHeight(y);

        return y;
    }

    @Override
    public void insert(int key) {
        root = insert(root, key);
    }

    private Node insert(Node node, int key) {
        if (node == null) {
            size++;
            return new Node(key);
        }

        if (key < node.key) {
            node.left = insert(node.left, key);
        } else if (key > node.key) {
            node.right = insert(node.right, key);
        } else {
            return node; // Ignore duplicate keys.
        }

        updateHeight(node);

        int balance = balanceFactor(node);

        // Case 1: Left-Left
        if (balance > 1 && key < node.left.key) {
            return rotateRight(node);
        }

        // Case 2: Right-Right
        if (balance < -1 && key > node.right.key) {
            return rotateLeft(node);
        }

        // Case 3: Left-Right
        if (balance > 1 && key > node.left.key) {
            node.left = rotateLeft(node.left);
            return rotateRight(node);
        }

        // Case 4: Right-Left
        if (balance < -1 && key < node.right.key) {
            node.right = rotateRight(node.right);
            return rotateLeft(node);
        }

        return node;
    }

    @Override
    public SearchResult search(int key) {
        Node current = root;
        int comparisons = 0;
        int depth = 0;

        while (current != null) {
            comparisons++;

            if (key == current.key) {
                return new SearchResult(
                    true, comparisons, 0, depth
                );
            }

            current = key < current.key
                ? current.left
                : current.right;

            depth++;
        }

        return new SearchResult(
            false, comparisons, 0, depth
        );
    }

    @Override
    public int height() {
        return nodeHeight(root);
    }

    @Override
    public int size() {
        return size;
    }

    @Override
    public String name() {
        return "AVL Tree";
    }

    // Verify BST ordering, stored heights, and AVL balance.
    public boolean isValidAVL() {
        return validate(root, Long.MIN_VALUE, Long.MAX_VALUE).valid;
    }

    private static class ValidationResult {
        boolean valid;
        int height;

        ValidationResult(boolean valid, int height) {
            this.valid = valid;
            this.height = height;
        }
    }

    private ValidationResult validate(
        Node node, long min, long max
    ) {
        if (node == null) {
            return new ValidationResult(true, -1);
        }

        if (node.key <= min || node.key >= max) {
            return new ValidationResult(false, -1);
        }

        ValidationResult left = validate(
            node.left, min, node.key
        );

        ValidationResult right = validate(
            node.right, node.key, max
        );

        int expectedHeight = 1 + Math.max(
            left.height, right.height
        );

        boolean correctHeight = node.height == expectedHeight;

        boolean balanced = Math.abs(
            left.height - right.height
        ) <= 1;

        return new ValidationResult(
            left.valid
                && right.valid
                && correctHeight
                && balanced,
            expectedHeight
        );
    }
}
