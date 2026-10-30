
public interface BenchmarkTree {

    void insert(int key);

    SearchResult search(int key);

    int height();

    int size();

    String name();
}
