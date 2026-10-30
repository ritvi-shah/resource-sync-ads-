import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class BenchmarkReportService {
    private static final List<String> EXPECTED_HEADER = List.of(
            "Workload", "Tree", "ResourceCount", "SearchCount", "HeightAfterMetrics",
            "AvgComparisons", "AvgDepth", "AvgRotationsPerSearch", "MedianSearchTimeMs");
    private static final Set<String> TREES = Set.of("Ordinary BST", "AVL Tree", "Splay Tree");
    private static final Set<String> WORKLOADS = Set.of(
            "Random searches", "Repeated hot-key searches", "Mixed campus access", "Zipf-like popularity");

    private final Path reportPath;

    public BenchmarkReportService(Path reportPath) {
        this.reportPath = reportPath;
    }

    public ResourceDtos.BenchmarkReportView readLatest() {
        String name = reportPath.getFileName() == null ? "benchmark-results.csv" : reportPath.getFileName().toString();
        if (!Files.isRegularFile(reportPath)) {
            return new ResourceDtos.BenchmarkReportView(false, name, "Benchmark report file is not available.", List.of());
        }
        try {
            List<String> lines = Files.readAllLines(reportPath, StandardCharsets.UTF_8);
            if (lines.isEmpty() || !parseRecord(lines.getFirst()).equals(EXPECTED_HEADER)) {
                return unavailable(name, "Benchmark report header is missing or malformed.");
            }
            List<ResourceDtos.BenchmarkRowView> rows = new ArrayList<>();
            Set<String> combinations = new HashSet<>();
            for (int index = 1; index < lines.size(); index++) {
                String line = lines.get(index);
                if (line.isBlank()) {
                    continue;
                }
                ResourceDtos.BenchmarkRowView row = parseRow(parseRecord(line));
                if (!combinations.add(row.workload() + "\u0000" + row.tree())) {
                    return unavailable(name, "Benchmark report contains a duplicate workload/tree combination.");
                }
                rows.add(row);
            }
            int expectedRows = WORKLOADS.size() * TREES.size();
            if (rows.size() != expectedRows || combinations.size() != expectedRows) {
                return unavailable(name, "Benchmark report must contain exactly one row for every expected workload/tree combination.");
            }
            return new ResourceDtos.BenchmarkReportView(true, name, "Loaded the existing benchmark report.", rows);
        } catch (IOException | IllegalArgumentException exception) {
            return unavailable(name, "Benchmark report is malformed or could not be read.");
        }
    }

    private ResourceDtos.BenchmarkRowView parseRow(List<String> fields) {
        if (fields.size() != EXPECTED_HEADER.size()) {
            throw new IllegalArgumentException("Unexpected CSV column count.");
        }
        String workload = fields.get(0);
        String tree = fields.get(1);
        if (!WORKLOADS.contains(workload) || !TREES.contains(tree)) {
            throw new IllegalArgumentException("Unknown benchmark label.");
        }
        int resourceCount = Integer.parseInt(fields.get(2));
        int searchCount = Integer.parseInt(fields.get(3));
        int height = Integer.parseInt(fields.get(4));
        double comparisons = Double.parseDouble(fields.get(5));
        double depth = Double.parseDouble(fields.get(6));
        double rotations = Double.parseDouble(fields.get(7));
        double medianTime = Double.parseDouble(fields.get(8));
        if (resourceCount < 1 || searchCount < 1 || height < -1
                || !finiteNonNegative(comparisons) || !finiteNonNegative(depth)
                || !finiteNonNegative(rotations) || !finiteNonNegative(medianTime)) {
            throw new IllegalArgumentException("Benchmark values are outside their valid range.");
        }
        return new ResourceDtos.BenchmarkRowView(workload, tree, resourceCount, searchCount, height,
                comparisons, depth, rotations, medianTime);
    }

    private boolean finiteNonNegative(double value) {
        return Double.isFinite(value) && value >= 0;
    }

    private List<String> parseRecord(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        boolean closedQuote = false;
        for (int i = 0; i < line.length(); i++) {
            char current = line.charAt(i);
            if (quoted) {
                if (current == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        quoted = false;
                        closedQuote = true;
                    }
                } else {
                    field.append(current);
                }
            } else if (current == ',') {
                fields.add(field.toString());
                field.setLength(0);
                closedQuote = false;
            } else if (current == '"' && field.isEmpty() && !closedQuote) {
                quoted = true;
            } else {
                if (closedQuote) {
                    throw new IllegalArgumentException("Unexpected character after a quoted CSV cell.");
                }
                field.append(current);
            }
        }
        if (quoted) {
            throw new IllegalArgumentException("Unclosed quoted CSV cell.");
        }
        fields.add(field.toString());
        return fields;
    }

    private ResourceDtos.BenchmarkReportView unavailable(String name, String message) {
        return new ResourceDtos.BenchmarkReportView(false, name, message, List.of());
    }
}
