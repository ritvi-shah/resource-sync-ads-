
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;

public class BenchmarkReport {

    private static final String HEADER =
        "Workload,Tree,ResourceCount,SearchCount,"
        + "HeightAfterMetrics,AvgComparisons,AvgDepth,"
        + "AvgRotationsPerSearch,MedianSearchTimeMs";

    private final Path outputPath;

    public BenchmarkReport(String filename) {
        this.outputPath = Paths.get(filename);
    }

    public void initialize() throws IOException {
        Path parent = outputPath.toAbsolutePath().getParent();

        if (parent != null) {
            Files.createDirectories(parent);
        }

        try (BufferedWriter writer = Files.newBufferedWriter(
                outputPath,
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE,
                StandardOpenOption.TRUNCATE_EXISTING)) {

            writer.write(HEADER);
            writer.newLine();
        }
    }

    public void writeRow(
            String workload,
            String tree,
            int resourceCount,
            int searchCount,
            int heightAfterMetrics,
            double avgComparisons,
            double avgDepth,
            double avgRotations,
            double medianTimeMs) throws IOException {

        try (BufferedWriter writer = Files.newBufferedWriter(
                outputPath,
                StandardCharsets.UTF_8,
                StandardOpenOption.APPEND)) {

            writer.write(
                csv(workload) + ","
                + csv(tree) + ","
                + resourceCount + ","
                + searchCount + ","
                + heightAfterMetrics + ","
                + avgComparisons + ","
                + avgDepth + ","
                + avgRotations + ","
                + medianTimeMs
            );

            writer.newLine();
        }
    }

    private String csv(String value) {
        if (value == null) {
            return "";
        }

        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    public String getOutputPath() {
        return outputPath.toAbsolutePath().toString();
    }
}
