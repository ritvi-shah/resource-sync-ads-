
public class SplayTreeTimingAdapter implements BenchmarkTree {

    private final SplayTree tree = new SplayTree();

    @Override
    public void insert(int key) {
        tree.insert(key);
    }

    @Override
    public SearchResult search(int key) {
        boolean found = tree.search(key);

        // This adapter is intended for timing only.
        // Do not use these placeholder metrics for analysis.
        return new SearchResult(found, 0, 0, 0);
    }

    public boolean searchForTiming(int key) {
        return tree.search(key);
    }

    @Override
    public int height() {
        return tree.height();
    }

    @Override
    public int size() {
        return tree.size();
    }

    @Override
    public String name() {
        return "Splay Tree";
    }
}
