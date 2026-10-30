
public class SplayTreeBenchmarkAdapter implements BenchmarkTree {

    private final SplayTree tree = new SplayTree();

    @Override
    public void insert(int key) {
        tree.insert(key);
    }

    @Override
    public SearchResult search(int key) {
        SplayTree.SearchStats stats = tree.searchWithStats(key);

        return new SearchResult(
            stats.found,
            stats.comparisons,
            stats.rotations,
            stats.searchDepth
        );
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
