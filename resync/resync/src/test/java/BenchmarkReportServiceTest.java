import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BenchmarkReportServiceTest {
    @Test
    void missingAndMalformedReportsReturnSafeUnavailableStates(@TempDir Path tempDir) throws Exception {
        Path missing = tempDir.resolve("missing.csv");
        assertFalse(new BenchmarkReportService(missing).readLatest().available());

        Path malformed = tempDir.resolve("broken.csv");
        Files.writeString(malformed, "Workload,Tree\n\"Random searches,Ordinary BST\n");
        var report = new BenchmarkReportService(malformed).readLatest();
        assertFalse(report.available());
        assertTrue(report.rows().isEmpty());
    }

    @Test
    void rejectsIncompleteAndDuplicateWorkloadTreeMatrices(@TempDir Path tempDir) throws Exception {
        String header = "Workload,Tree,ResourceCount,SearchCount,HeightAfterMetrics,AvgComparisons,AvgDepth,AvgRotationsPerSearch,MedianSearchTimeMs";
        String row = "Random searches,Ordinary BST,1000,10000,999,10.0,9.0,0.0,0.1";
        Path incomplete = tempDir.resolve("incomplete.csv");
        Files.writeString(incomplete, header + "\n" + row + "\n");
        assertFalse(new BenchmarkReportService(incomplete).readLatest().available());

        Path duplicate = tempDir.resolve("duplicate.csv");
        Files.writeString(duplicate, header + "\n" + row + "\n" + row + "\n");
        assertFalse(new BenchmarkReportService(duplicate).readLatest().available());
    }
}
