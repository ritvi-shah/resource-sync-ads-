
public class OrdinaryBST implements BenchmarkTree {

    private static class Node {
        int key;
        Node left;
        Node right;

        Node(int key) {
            this.key = key;
        }
    }

    private Node root;
    private int nodeCount;

    @Override
    public void insert(int key) {
        if (root == null) {
            root = new Node(key);
            nodeCount++;
            return;
        }

        Node current = root;

        while (true) {
            if (key == current.key) {
                return; // Ignore duplicates.
            }

            if (key < current.key) {
                if (current.left == null) {
                    current.left = new Node(key);
                    nodeCount++;
                    return;
                }
                current = current.left;
            } else {
                if (current.right == null) {
                    current.right = new Node(key);
                    nodeCount++;
                    return;
                }
                current = current.right;
            }
        }
    }

    @Override
    public SearchResult search(int key) {
        Node current = root;
        int comparisons = 0;
        int depth = 0;

        while (current != null) {
            depth++;
            comparisons++;

            if (key == current.key) {
                return new SearchResult(
                        true, comparisons, 0, depth);
            }

            current = key < current.key
                    ? current.left
                    : current.right;
        }

        return new SearchResult(
                false, comparisons, 0, depth);
    }

    @Override
    public int height() {
        return height(root);
    }

    private int height(Node node) {
        if (node == null) {
            return -1;
        }

        return 1 + Math.max(
                height(node.left),
                height(node.right));
    }

    @Override
    public int size() {
        return nodeCount;
    }

    @Override
    public String name() {
        return "Ordinary BST";
    }
}
