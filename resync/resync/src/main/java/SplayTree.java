
public class SplayTree {

    static class Node {
        int key;
        Node left;
        Node right;

        Node(int key) {
            this.key = key;
        }
    }

    private Node root;
    private int rotationCount;

    public Integer getRootKey() {
        return root == null ? null : root.key;
    }

    public int getRotationCount() {
        return rotationCount;
    }

    public boolean isEmpty() {
        return root == null;
    }

    // Right rotation: promote the left child.
    private Node rotateRight(Node x) {
        Node y = x.left;

        x.left = y.right;
        y.right = x;

        rotationCount++;
        return y;
    }

    // Left rotation: promote the right child.
    private Node rotateLeft(Node x) {
        Node y = x.right;

        x.right = y.left;
        y.left = x;

        rotationCount++;
        return y;
    }

    // Move the requested key toward the root.
    // If absent, splay the last node reached.
    private Node splay(Node node, int key) {
        if (node == null || node.key == key) {
            return node;
        }

        if (key < node.key) {
            if (node.left == null) {
                return node;
            }

            // Zig-Zig: left-left.
            if (key < node.left.key) {
                node.left.left = splay(node.left.left, key);
                node = rotateRight(node);
            }
            // Zig-Zag: left-right.
            else if (key > node.left.key) {
                node.left.right = splay(node.left.right, key);

                if (node.left.right != null) {
                    node.left = rotateLeft(node.left);
                }
            }

            return node.left == null
                    ? node
                    : rotateRight(node);
        } else {
            if (node.right == null) {
                return node;
            }

            // Zig-Zag: right-left.
            if (key < node.right.key) {
                node.right.left = splay(node.right.left, key);

                if (node.right.left != null) {
                    node.right = rotateRight(node.right);
                }
            }
            // Zig-Zig: right-right.
            else if (key > node.right.key) {
                node.right.right = splay(node.right.right, key);
                node = rotateLeft(node);
            }

            return node.right == null
                    ? node
                    : rotateLeft(node);
        }
    }

    // Insert a unique key and splay it to the root.
    public void insert(int key) {
        if (root == null) {
            root = new Node(key);
            return;
        }

        root = splay(root, key);

        if (root.key == key) {
            return; // Ignore duplicate keys.
        }

        Node newNode = new Node(key);

        if (key < root.key) {
            newNode.left = root.left;
            newNode.right = root;
            root.left = null;
        } else {
            newNode.right = root.right;
            newNode.left = root;
            root.right = null;
        }

        root = newNode;
    }

    // Search and splay the found or last-accessed node.
    public boolean search(int key) {
        if (root == null) {
            return false;
        }

        root = splay(root, key);
        return root.key == key;
    }

    public void displayInOrder() {
        inOrder(root);
        System.out.println();
    }

    private void inOrder(Node node) {
        if (node == null) {
            return;
        }

        inOrder(node.left);
        System.out.print(node.key + " ");
        inOrder(node.right);
    }

    // Verifies that every key obeys the BST ordering rules.
    public boolean isValidBST() {
        return isValidBST(root, Long.MIN_VALUE, Long.MAX_VALUE);
    }

    private boolean isValidBST(Node node, long min, long max) {
        if (node == null) {
            return true;
        }

        if (node.key <= min || node.key >= max) {
            return false;
        }

        return isValidBST(node.left, min, node.key)
                && isValidBST(node.right, node.key, max);
    }

    // Test fixture helper: builds a tree from level-order keys.
    // Null entries represent missing nodes.
    static SplayTree fromLevelOrderForTesting(Integer... keys) {
        SplayTree tree = new SplayTree();

        if (keys.length == 0 || keys[0] == null) {
            return tree;
        }

        Node[] nodes = new Node[keys.length];

        for (int i = 0; i < keys.length; i++) {
            if (keys[i] != null) {
                nodes[i] = new Node(keys[i]);
            }
        }

        for (int i = 0; i < keys.length; i++) {
            if (nodes[i] == null) {
                continue;
            }

            int left = 2 * i + 1;
            int right = 2 * i + 2;

            if (left < keys.length) {
                nodes[i].left = nodes[left];
            }

            if (right < keys.length) {
                nodes[i].right = nodes[right];
            }
        }

        tree.root = nodes[0];
        return tree;
    }

    // Deletes a key if present.
    // Returns true if a key was deleted.
    public boolean delete(int key) {
        if (root == null) {
            return false;
        }

        // Bring the target, or the last visited node, to the root.
        root = splay(root, key);

        // The key does not exist.
        if (root.key != key) {
            return false;
        }

        Node leftSubtree = root.left;
        Node rightSubtree = root.right;

        // Detach the deleted node.
        root.left = null;
        root.right = null;

        if (leftSubtree == null) {
            root = rightSubtree;
        } else {
            // The maximum key in the left subtree becomes its root.
            leftSubtree = splay(leftSubtree, key);

            // Since key is greater than every key in leftSubtree,
            // the splay operation brings its maximum node to the root.
            leftSubtree.right = rightSubtree;
            root = leftSubtree;
        }

        return true;
    }

    // Returns all keys in sorted order for testing and diagnostics.
    public java.util.List<Integer> getKeysInOrder() {
        java.util.List<Integer> keys = new java.util.ArrayList<>();
        collectKeys(root, keys);
        return keys;
    }

    private void collectKeys(Node node, java.util.List<Integer> keys) {
        if (node == null) {
            return;
        }

        collectKeys(node.left, keys);
        keys.add(node.key);
        collectKeys(node.right, keys);
    }

    // Statistics for one search operation.
    public static class SearchStats {
        public final int key;
        public final boolean found;
        public final int comparisons;
        public final int searchDepth;
        public final int rotations;
        public final Integer rootAfterSearch;

        public SearchStats(
                int key,
                boolean found,
                int comparisons,
                int searchDepth,
                int rotations,
                Integer rootAfterSearch) {

            this.key = key;
            this.found = found;
            this.comparisons = comparisons;
            this.searchDepth = searchDepth;
            this.rotations = rotations;
            this.rootAfterSearch = rootAfterSearch;
        }
    }

    public record TreeNodeSnapshot(
            int key,
            Integer parentKey,
            Integer leftKey,
            Integer rightKey,
            int depth) {
    }

    public record TreeSnapshot(
            Integer rootKey,
            int size,
            int height,
            java.util.List<TreeNodeSnapshot> nodes) {
        public TreeSnapshot {
            nodes = java.util.List.copyOf(nodes);
        }
    }

    // Search with measurable operation costs.

public SearchStats searchWithStats(int key) {
    int comparisons = 0;
    int depth = 0;
    Node current = root;

    // Count key comparisons and track the depth in edges.
    // The root is at depth 0.
    while (current != null) {
        comparisons++;

        if (key == current.key) {
            break;
        }

        if (key < current.key) {
            current = current.left;
        } else {
            current = current.right;
        }

        depth++;
    }

    boolean found = current != null;

    // For an unsuccessful search, depth is the depth of the
    // last visited node, or -1 when the tree is empty.
    int searchDepth = current == null
            ? (comparisons == 0 ? -1 : depth - 1)
            : depth;

    int rotationsBefore = rotationCount;

    if (root != null) {
        root = splay(root, key);
    }

    int rotationsPerformed = rotationCount - rotationsBefore;

    return new SearchStats(
            key,
            found,
            comparisons,
            searchDepth,
            rotationsPerformed,
            getRootKey()
    );
}

    // Returns an immutable copy of the current shape without splaying or mutating nodes.
    public TreeSnapshot getTreeSnapshot() {
        java.util.List<TreeNodeSnapshot> nodes = new java.util.ArrayList<>();
        collectTreeSnapshot(root, null, 0, nodes);
        return new TreeSnapshot(getRootKey(), nodes.size(), height(), nodes);
    }

    private void collectTreeSnapshot(
            Node node,
            Integer parentKey,
            int depth,
            java.util.List<TreeNodeSnapshot> nodes) {
        if (node == null) {
            return;
        }
        nodes.add(new TreeNodeSnapshot(
                node.key,
                parentKey,
                node.left == null ? null : node.left.key,
                node.right == null ? null : node.right.key,
                depth));
        collectTreeSnapshot(node.left, node.key, depth + 1, nodes);
        collectTreeSnapshot(node.right, node.key, depth + 1, nodes);
    }

    public int height() {
    return height(root);
}

private int height(Node node) {
    if (node == null) {
        return -1;
    }

    return 1 + Math.max(
        height(node.left),
        height(node.right)
    );
}

public int size() {
    return getKeysInOrder().size();
}

}
