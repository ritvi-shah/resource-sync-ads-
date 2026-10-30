
import java.nio.file.Files;
import java.nio.file.Path;

public class BenchmarkReportTest {

    public static void main(String[] args) throws Exception {
        Path testFile = Path.of("out", "benchmark-report-test.csv");

        BenchmarkReport report =
            new BenchmarkReport(testFile.toString());

        report.initialize();

        report.writeRow(
            "Random searches",
            "AVL Tree",
            1000,
            10000,
            9,
            8.99,
            7.99,
            0.0,
            0.401
        );

        var lines = Files.readAllLines(testFile);

        if (lines.size() != 2) {
            throw new AssertionError(
                "Expected header and one data row"
            );
        }

        if (!lines.get(0).contains("Workload,Tree")) {
            throw new AssertionError("CSV header missing");
        }

        if (!lines.get(1).contains("\"AVL Tree\"")) {
            throw new AssertionError("Tree name missing");
        }

        System.out.println("CSV output: " + testFile);
        System.out.println("Header: " + lines.get(0));
        System.out.println("Row: " + lines.get(1));
        System.out.println("ALL BENCHMARK REPORT TESTS PASSED");
    }
}
