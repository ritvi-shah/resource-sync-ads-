
import java.util.List;

public class ZipfWorkloadTest {

    public static void main(String[] args) {
        List<Integer> first =
            getZipfWorkload();

        List<Integer> second =
            getZipfWorkload();

        if (!first.equals(second)) {
            throw new AssertionError(
                "Zipf-like workload is not reproducible"
            );
        }

        BenchmarkRunner.validateZipfLikeSearches(first);

        System.out.println(
            "ZIPF REPRODUCIBILITY TEST PASSED"
        );
    }

    private static List<Integer> getZipfWorkload() {
        // Package-private access is available because both classes
        // are in the default package.
        return BenchmarkRunner.createZipfLikeSearchesForTesting();
    }
}
