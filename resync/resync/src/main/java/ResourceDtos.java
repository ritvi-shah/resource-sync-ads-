import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class ResourceDtos {
    private ResourceDtos() {
    }

    public record ResourceWriteRequest(
            @NotNull @Positive Integer id,
            @NotBlank @Size(max = 160) String title,
            @Size(max = 4000) String description,
            @NotBlank @Size(max = 80) String category,
            @NotBlank @Size(max = 80) String resourceType,
            @Size(max = 120) String subject,
            @Size(max = 80) String academicTerm,
            @Size(max = 2048)
            @Pattern(regexp = "^$|^https?://[^\\s]+$", message = "resourceUrl must be an absolute HTTP(S) URL") String resourceUrl,
            @Size(max = 2048) String resourceReference,
            @Size(max = 30) List<@NotBlank @Size(max = 48) String> tags) {
        public ResourceWriteRequest {
            tags = tags == null ? List.of() : List.copyOf(tags);
        }
    }

    public record ResourceView(
            int id,
            String title,
            String description,
            String category,
            String resourceType,
            String subject,
            String academicTerm,
            String resourceUrl,
            String resourceReference,
            List<String> tags,
            Instant createdAt,
            Instant updatedAt,
            boolean sample,
            long accessCount,
            Instant lastAccessed,
            long attachmentCount) {
        public ResourceView {
            tags = tags == null ? List.of() : List.copyOf(tags);
        }
    }

    public record ResourcePageView(List<ResourceView> items, int page, int size, long totalElements, int totalPages) {
        public ResourcePageView {
            items = List.copyOf(items);
        }
    }

    public record SearchMetricsView(
            int resourceId,
            boolean found,
            int comparisons,
            int searchDepth,
            int rotations,
            Integer rootAfterSearch,
            Instant searchedAt) {
    }

    public record ResourceLookupView(ResourceView resource, SearchMetricsView search) {
    }

    public record PopularResourceView(int rank, ResourceView resource) {
    }

    public record RecentResourceView(ResourceView resource, Instant accessedAt) {
    }

    public record TreeNodeView(int id, Integer parentId, Integer leftId, Integer rightId, int depth) {
    }

    public record TreeSnapshotView(
            int size,
            int height,
            Integer rootId,
            Integer lastAccessedResourceId,
            SearchMetricsView latestSearch,
            List<TreeNodeView> nodes) {
        public TreeSnapshotView {
            nodes = List.copyOf(nodes);
        }
    }

    public record TreeMetricsView(Integer rootId, int size, int height, SearchMetricsView latestSearch) {
    }

    public record AnalyticsSummaryView(
            long resourceCount,
            long categoryCount,
            long totalAccesses,
            int treeSize,
            int treeHeight,
            List<PopularResourceView> popularResources,
            List<RecentResourceView> recentResources) {
        public AnalyticsSummaryView {
            popularResources = List.copyOf(popularResources);
            recentResources = List.copyOf(recentResources);
        }
    }

    public record BenchmarkRowView(
            String workload,
            String tree,
            int resourceCount,
            int searchCount,
            int heightAfterMetrics,
            double avgComparisons,
            double avgDepth,
            double avgRotationsPerSearch,
            double medianSearchTimeMs) {
    }

    public record BenchmarkReportView(boolean available, String reportName, String message, List<BenchmarkRowView> rows) {
        public BenchmarkReportView {
            rows = List.copyOf(rows);
        }
    }

    public record ApiError(
            String code,
            String message,
            Map<String, String> details,
            Instant timestamp,
            SearchMetricsView searchMetrics) {
        public ApiError {
            details = details == null ? Map.of() : Map.copyOf(details);
        }
    }

    public record AttachmentView(
            int id,
            int resourceId,
            String originalFilename,
            long sizeBytes,
            String contentType,
            Instant uploadedAt) {
    }

    public record AttachmentPolicyView(long maxFileSizeBytes, String contentType, int maxFilesPerRequest) {
    }
}
