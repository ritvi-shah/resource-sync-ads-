
public class SearchResult {

    public final boolean found;
    public final int comparisons;
    public final int rotations;
    public final int searchDepth;

    public SearchResult(
            boolean found,
            int comparisons,
            int rotations,
            int searchDepth) {

        this.found = found;
        this.comparisons = comparisons;
        this.rotations = rotations;
        this.searchDepth = searchDepth;
    }
}
