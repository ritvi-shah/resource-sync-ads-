import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class AnalyticsController {
    private final CatalogService catalog;
    private final BenchmarkReportService benchmarkReports;

    public AnalyticsController(CatalogService catalog, BenchmarkReportService benchmarkReports) {
        this.catalog = catalog;
        this.benchmarkReports = benchmarkReports;
    }

    @GetMapping("/resources/popular")
    public List<ResourceDtos.PopularResourceView> popular(@RequestParam(defaultValue = "10") int limit) {
        return catalog.popularResources(limit);
    }

    @GetMapping("/resources/recent")
    public List<ResourceDtos.RecentResourceView> recent(@RequestParam(defaultValue = "20") int limit) {
        return catalog.recentResources(limit);
    }

    @GetMapping("/analytics/summary")
    public ResourceDtos.AnalyticsSummaryView summary() {
        return catalog.analyticsSummary();
    }

    @GetMapping("/analytics/benchmarks")
    public ResourceDtos.BenchmarkReportView benchmarks() {
        return benchmarkReports.readLatest();
    }

    @GetMapping("/dsa/splay-tree")
    public ResourceDtos.TreeSnapshotView tree() {
        return catalog.treeSnapshot();
    }

    @GetMapping("/dsa/splay-tree/metrics")
    public ResourceDtos.TreeMetricsView metrics() {
        return catalog.treeMetrics();
    }
}
