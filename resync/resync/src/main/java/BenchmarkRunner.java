
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Random;

public class BenchmarkRunner {

    private static final int KEY_COUNT = 1000;
    private static final int SEARCH_COUNT = 10000;
    private static final int HOT_KEY_SEARCHES = 5000;
    private static final int TIMING_REPETITIONS = 7;

    private static volatile long timingSink = 0;

    public static void main(String[] args) throws IOException {

        BenchmarkReport report =
                new BenchmarkReport("out/benchmark-results.csv");

        report.initialize();

        runWorkload(
                "Random searches",
                createRandomSearches(),
                report
        );

        runWorkload(
                "Repeated hot-key searches",
                createHotKeySearches(),
                report
        );

        runWorkload(
                "Mixed campus access",
                createMixedAccessSearches(),
                report
        );

        runWorkload(
                "Zipf-like popularity",
                createZipfLikeSearchesForTesting(),
                report
        );

        System.out.println();
        System.out.println("All benchmark workloads completed.");
        System.out.println(
                "CSV report saved to: " + report.getOutputPath()
        );
        System.out.println("Timing sink: " + timingSink);
    }

    private static void runWorkload(
            String workloadName,
            List<Integer> searches,
            BenchmarkReport report
    ) throws IOException {

        System.out.println();
        System.out.println("=".repeat(100));
        System.out.println("WORKLOAD: " + workloadName);
        System.out.println("Resources: " + KEY_COUNT);
        System.out.println("Searches: " + searches.size());
        System.out.println("Depth is measured in edges; root depth = 0.");
        System.out.println(
                "Timing uses fresh trees and ordinary search methods."
        );
        System.out.println("=".repeat(100));

        List<BenchmarkTree> metricTrees = List.of(
                buildOrdinaryBST(),
                buildAVLTree(),
                buildSplayTree()
        );

        System.out.printf(
                "%-18s %8s %13s %12s %15s %15s%n",
                "Tree",
                "Height",
                "Avg Compare",
                "Avg Depth",
                "Avg Rotations",
                "Median Time"
        );

        for (int i = 0; i < metricTrees.size(); i++) {

            BenchmarkTree metricTree = metricTrees.get(i);

            long totalComparisons = 0;
            long totalDepth = 0;
            long totalRotations = 0;

            for (int key : searches) {

                SearchResult result = metricTree.search(key);

                totalComparisons += result.comparisons;
                totalRotations += result.rotations;
                totalDepth += result.searchDepth;
            }

            double avgComparisons =
                    (double) totalComparisons / searches.size();

            double avgDepth =
                    (double) totalDepth / searches.size();

            double avgRotations =
                    (double) totalRotations / searches.size();

            int heightAfterMetrics = metricTree.height();

            // Timing is measured separately on fresh trees.
            long elapsedNanos = timeSearches(i, searches);

            double medianTimeMs =
                    elapsedNanos / 1_000_000.0;

            System.out.printf(
                    "%-18s %8d %13.2f %12.2f %15.2f %12.3f ms%n",
                    metricTree.name(),
                    heightAfterMetrics,
                    avgComparisons,
                    avgDepth,
                    avgRotations,
                    medianTimeMs
            );

            // Save the same results displayed in the console.
            report.writeRow(
                    workloadName,
                    metricTree.name(),
                    metricTree.size(),
                    searches.size(),
                    heightAfterMetrics,
                    avgComparisons,
                    avgDepth,
                    avgRotations,
                    medianTimeMs
            );
        }
    }

    private static long timeSearches(
            int treeIndex,
            List<Integer> searches
    ) {

        // Warm up the JVM using a separate tree.
        BenchmarkTree warmupTree = buildTree(treeIndex);

        int warmupCount = Math.min(1000, searches.size());

        for (int i = 0; i < warmupCount; i++) {

            SearchResult result =
                    warmupTree.search(searches.get(i));

            if (result.found) {
                timingSink++;
            }
        }

        long[] times = new long[TIMING_REPETITIONS];

        for (int repetition = 0;
             repetition < TIMING_REPETITIONS;
             repetition++) {

            // Each repetition starts with a fresh tree.
            BenchmarkTree tree = buildTree(treeIndex);
            long foundCount = 0;

            long start = System.nanoTime();

            for (int key : searches) {

                if (treeIndex == 2) {

                    SplayTreeTimingAdapter splay =
                            (SplayTreeTimingAdapter) tree;

                    if (splay.searchForTiming(key)) {
                        foundCount++;
                    }

                } else {

                    SearchResult result = tree.search(key);

                    if (result.found) {
                        foundCount++;
                    }
                }
            }

            times[repetition] = System.nanoTime() - start;
            timingSink += foundCount;
        }

        Arrays.sort(times);

        // Seven measurements: select the middle value.
        return times[TIMING_REPETITIONS / 2];
    }

    private static BenchmarkTree buildTree(int index) {

        switch (index) {

            case 0:
                return buildOrdinaryBST();

            case 1:
                return buildAVLTree();

            case 2:
                return buildSplayTimingTree();

            default:
                throw new IllegalArgumentException(
                        "Unknown tree index: " + index
                );
        }
    }

    private static BenchmarkTree buildOrdinaryBST() {

        BenchmarkTree tree = new OrdinaryBST();

        for (int key = 1; key <= KEY_COUNT; key++) {
            tree.insert(key);
        }

        return tree;
    }

    private static BenchmarkTree buildAVLTree() {

        BenchmarkTree tree = new AVLTree();

        for (int key = 1; key <= KEY_COUNT; key++) {
            tree.insert(key);
        }

        return tree;
    }

    private static BenchmarkTree buildSplayTree() {

        BenchmarkTree tree = new SplayTreeBenchmarkAdapter();

        for (int key = 1; key <= KEY_COUNT; key++) {
            tree.insert(key);
        }

        return tree;
    }

    private static BenchmarkTree buildSplayTimingTree() {

        BenchmarkTree tree = new SplayTreeTimingAdapter();

        for (int key = 1; key <= KEY_COUNT; key++) {
            tree.insert(key);
        }

        return tree;
    }

    private static List<Integer> createRandomSearches() {

        List<Integer> searches = new ArrayList<>();
        Random random = new Random(42);

        for (int i = 0; i < SEARCH_COUNT; i++) {
            searches.add(1 + random.nextInt(KEY_COUNT));
        }

        return searches;
    }

    private static List<Integer> createHotKeySearches() {

        List<Integer> searches = new ArrayList<>();

        for (int i = 0; i < HOT_KEY_SEARCHES; i++) {
            searches.add(500);
        }

        List<Integer> otherKeys = new ArrayList<>();

        for (int key = 1; key <= KEY_COUNT; key++) {
            if (key != 500) {
                otherKeys.add(key);
            }
        }

        Collections.shuffle(otherKeys, new Random(42));

        for (int i = 0;
             i < SEARCH_COUNT - HOT_KEY_SEARCHES;
             i++) {

            searches.add(otherKeys.get(i % otherKeys.size()));
        }

        return searches;
    }

    private static List<Integer> createMixedAccessSearches() {

        List<Integer> searches = new ArrayList<>();
        Random random = new Random(2026);

        // 70% popular resources: IDs 1-100.
        for (int i = 0; i < 7000; i++) {
            searches.add(1 + random.nextInt(100));
        }

        // 20% occasional resources: IDs 101-400.
        for (int i = 0; i < 2000; i++) {
            searches.add(101 + random.nextInt(300));
        }

        // 10% long-tail resources: IDs 401-1000.
        for (int i = 0; i < 1000; i++) {
            searches.add(401 + random.nextInt(600));
        }

        Collections.shuffle(searches, new Random(42));

        return searches;
    }

    static List<Integer> createZipfLikeSearchesForTesting() {

        List<Integer> searches = new ArrayList<>();
        Random random = new Random(2027);

        double[] cumulativeWeights = new double[KEY_COUNT];
        double totalWeight = 0.0;

        for (int rank = 1; rank <= KEY_COUNT; rank++) {
            totalWeight += 1.0 / rank;
            cumulativeWeights[rank - 1] = totalWeight;
        }

        for (int i = 0; i < SEARCH_COUNT; i++) {

            double target = random.nextDouble() * totalWeight;

            int low = 0;
            int high = KEY_COUNT - 1;

            while (low < high) {

                int mid = low + (high - low) / 2;

                if (cumulativeWeights[mid] < target) {
                    low = mid + 1;
                } else {
                    high = mid;
                }
            }

            searches.add(low + 1);
        }

        return searches;
    }

    static void validateZipfLikeSearches(List<Integer> searches) {

        if (searches.size() != SEARCH_COUNT) {
            throw new AssertionError(
                    "Expected " + SEARCH_COUNT + " Zipf-like searches"
            );
        }

        int[] frequencies = new int[KEY_COUNT];

        for (int key : searches) {

            if (key < 1 || key > KEY_COUNT) {
                throw new AssertionError(
                        "Invalid resource ID: " + key
                );
            }

            frequencies[key - 1]++;
        }

        int top10 = 0;
        int ranks11To100 = 0;
        int ranks101To500 = 0;
        int ranks501To1000 = 0;

        for (int rank = 1; rank <= KEY_COUNT; rank++) {

            int frequency = frequencies[rank - 1];

            if (rank <= 10) {
                top10 += frequency;
            } else if (rank <= 100) {
                ranks11To100 += frequency;
            } else if (rank <= 500) {
                ranks101To500 += frequency;
            } else {
                ranks501To1000 += frequency;
            }
        }

        System.out.println("Zipf-like workload distribution:");
        System.out.println("Top 10 resources: " + top10);
        System.out.println("Ranks 11-100: " + ranks11To100);
        System.out.println("Ranks 101-500: " + ranks101To500);
        System.out.println("Ranks 501-1000: " + ranks501To1000);
    }
}
