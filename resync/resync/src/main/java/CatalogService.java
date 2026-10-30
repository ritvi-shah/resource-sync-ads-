import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class CatalogService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_RECENT_LIMIT = 20;

    private final ResourceRepository repository;
    private final ResourceAccessService accessService;
    private final SplayTree tree;
    private final AccessTracker tracker;
    private final AttachmentService attachmentService;
    private volatile ResourceDtos.SearchMetricsView latestSearch;
    private volatile Integer lastAccessedResourceId;

    public CatalogService(
            ResourceRepository repository,
            ResourceAccessService accessService,
            SplayTree tree,
            AccessTracker tracker,
            AttachmentService attachmentService) {
        this.repository = repository;
        this.accessService = accessService;
        this.tree = tree;
        this.tracker = tracker;
        this.attachmentService = attachmentService;
        List<Integer> recent = tracker.getRecentAccesses();
        this.lastAccessedResourceId = recent.isEmpty() ? null : recent.getFirst();
    }

    public synchronized ResourceDtos.ResourcePageView listResources(
            String query,
            String category,
            String resourceType,
            int page,
            int size,
            String sortBy,
            String direction) {
        validatePaging(page, size);
        String normalizedSort = normalizeSort(sortBy);
        String normalizedDirection = normalizeDirection(direction);
        long offsetLong = (long) page * size;
        if (offsetLong > Integer.MAX_VALUE) {
            throw new InvalidRequestException("The requested page is too large.");
        }
        List<ResourceRepository.ResourceActivity> records = repository.findPage(
                clean(query), clean(category), clean(resourceType), (int) offsetLong, size, normalizedSort, normalizedDirection);
        long total = repository.count(clean(query), clean(category), clean(resourceType));
        int totalPages = total == 0 ? 0 : (int) ((total + size - 1) / size);
        return new ResourceDtos.ResourcePageView(records.stream().map(this::view).toList(), page, size, total, totalPages);
    }

    public synchronized ResourceDtos.ResourcePageView searchResources(String query, String category, String resourceType, int limit) {
        if (query == null || query.isBlank()) {
            throw new InvalidRequestException("Query parameter q must not be blank.");
        }
        if (query.length() > 160) {
            throw new InvalidRequestException("Query parameter q must be at most 160 characters.");
        }
        if (limit < 1 || limit > MAX_PAGE_SIZE) {
            throw new InvalidRequestException("limit must be between 1 and " + MAX_PAGE_SIZE + ".");
        }
        List<ResourceRepository.ResourceActivity> records = repository.findPage(
                query.trim(), clean(category), clean(resourceType), 0, limit, "title", "asc");
        long total = repository.count(query.trim(), clean(category), clean(resourceType));
        int totalPages = total == 0 ? 0 : (int) ((total + limit - 1) / limit);
        return new ResourceDtos.ResourcePageView(records.stream().map(this::view).toList(), 0, limit, total, totalPages);
    }

    @Transactional
    public synchronized ResourceDtos.ResourceView create(ResourceDtos.ResourceWriteRequest request) {
        Resource resource = resourceFrom(request, Instant.now(), false);
        try {
            repository.insert(resource);
        } catch (DuplicateResourceException duplicate) {
            throw duplicate;
        } catch (DataIntegrityViolationException duplicate) {
            throw new DuplicateResourceException(request.id());
        }
        tree.insert(resource.id());
        return repository.findActivityById(resource.id()).map(this::view).orElseThrow();
    }

    @Transactional
    public synchronized ResourceDtos.ResourceView update(int pathId, ResourceDtos.ResourceWriteRequest request) {
        validateResourceId(pathId);
        if (request.id() == null || request.id() != pathId) {
            throw new InvalidRequestException("The resource ID in the request body must match the path ID.");
        }
        Resource existing = repository.findById(pathId).orElseThrow(() -> new ResourceNotFoundException(pathId, null));
        Resource updated = resourceFrom(request, existing.createdAt(), existing.sample());
        if (!repository.update(updated)) {
            throw new ResourceNotFoundException(pathId, null);
        }
        return repository.findActivityById(pathId).map(this::view).orElseThrow();
    }

    @Transactional
    public synchronized void delete(int id) {
        validateResourceId(id);
        if (repository.findById(id).isEmpty()) {
            throw new ResourceNotFoundException(id, null);
        }
        attachmentService.deleteForResource(id);
        if (!repository.delete(id)) {
            throw new ResourceNotFoundException(id, null);
        }
        if (!tree.delete(id)) {
            throw new IllegalStateException("The Splay Tree did not contain a resource removed from the catalog.");
        }
        tracker.removeResource(id);
        if (lastAccessedResourceId != null && lastAccessedResourceId == id) {
            List<Integer> recent = tracker.getRecentAccesses();
            lastAccessedResourceId = recent.isEmpty() ? null : recent.getFirst();
        }
    }

    @Transactional
    public synchronized ResourceDtos.ResourceLookupView accessById(int id) {
        validateResourceId(id);
        Instant accessTime = Instant.now();
        Optional<Resource> resourceBeforeLookup = repository.findById(id);
        if (resourceBeforeLookup.isEmpty()) {
            SplayTree.SearchStats missingStats = accessService.searchResourceWithoutRecording(id);
            ResourceDtos.SearchMetricsView missingMetrics = metrics(missingStats, accessTime);
            latestSearch = missingMetrics;
            throw new ResourceNotFoundException(id, missingMetrics);
        }
        long eventId = repository.insertAccessEvent(id, accessTime);
        SplayTree.SearchStats stats = accessService.accessResource(id, accessTime);
        ResourceDtos.SearchMetricsView metrics = metrics(stats, accessTime);
        latestSearch = metrics;
        if (!stats.found) {
            repository.deleteAccessEvent(eventId);
            throw new ResourceNotFoundException(id, metrics);
        }
        Resource resource = resourceBeforeLookup.orElseThrow(() -> new ResourceNotFoundException(id, metrics));
        lastAccessedResourceId = id;
        return new ResourceDtos.ResourceLookupView(repository.findActivityById(id).map(this::view).orElseGet(() -> view(resource, 0, null)), metrics);
    }

    public synchronized ResourceDtos.TreeSnapshotView treeSnapshot() {
        SplayTree.TreeSnapshot snapshot = tree.getTreeSnapshot();
        List<ResourceDtos.TreeNodeView> nodes = snapshot.nodes().stream()
                .map(node -> new ResourceDtos.TreeNodeView(node.key(), node.parentKey(), node.leftKey(), node.rightKey(), node.depth()))
                .toList();
        return new ResourceDtos.TreeSnapshotView(snapshot.size(), snapshot.height(), snapshot.rootKey(), lastAccessedResourceId, latestSearch, nodes);
    }

    public synchronized ResourceDtos.TreeMetricsView treeMetrics() {
        return new ResourceDtos.TreeMetricsView(tree.getRootKey(), tree.size(), tree.height(), latestSearch);
    }

    public synchronized List<ResourceDtos.PopularResourceView> popularResources(int limit) {
        if (limit < 1 || limit > MAX_PAGE_SIZE) {
            throw new InvalidRequestException("limit must be between 1 and " + MAX_PAGE_SIZE + ".");
        }
        List<ResourceRepository.ResourceActivity> rows = repository.findPopular(limit);
        List<ResourceDtos.PopularResourceView> result = new ArrayList<>(rows.size());
        for (int i = 0; i < rows.size(); i++) {
            result.add(new ResourceDtos.PopularResourceView(i + 1, view(rows.get(i))));
        }
        return List.copyOf(result);
    }

    public synchronized List<ResourceDtos.RecentResourceView> recentResources(int requestedLimit) {
        if (requestedLimit < 1 || requestedLimit > MAX_RECENT_LIMIT) {
            throw new InvalidRequestException("limit must be between 1 and " + MAX_RECENT_LIMIT + ".");
        }
        List<Integer> ids = tracker.getRecentAccesses().stream().limit(requestedLimit).toList();
        Map<Integer, Instant> lastAccesses = repository.findLastAccessedFor(ids);
        List<ResourceDtos.RecentResourceView> result = new ArrayList<>();
        for (Integer id : ids) {
            repository.findActivityById(id).ifPresent(activity -> {
                Instant accessedAt = lastAccesses.get(id);
                if (accessedAt != null) {
                    result.add(new ResourceDtos.RecentResourceView(view(activity), accessedAt));
                }
            });
        }
        return List.copyOf(result);
    }

    public synchronized ResourceDtos.AnalyticsSummaryView analyticsSummary() {
        return new ResourceDtos.AnalyticsSummaryView(
                repository.resourceCount(),
                repository.categoryCount(),
                repository.totalAccessCount(),
                tree.size(),
                tree.height(),
                popularResources(5),
                recentResources(MAX_RECENT_LIMIT));
    }

    private Resource resourceFrom(ResourceDtos.ResourceWriteRequest request, Instant createdAt, boolean sample) {
        String url = normalizeUrl(request.resourceUrl());
        String reference = normalizeResourceReference(request.resourceReference());
        return new Resource(
                request.id(),
                request.title().trim(),
                clean(request.description()),
                request.category().trim(),
                request.resourceType().trim(),
                clean(request.subject()),
                clean(request.academicTerm()),
                url,
                reference,
                request.tags() == null ? List.of() : request.tags().stream().map(String::trim).filter(tag -> !tag.isEmpty()).distinct().toList(),
                createdAt,
                Instant.now(),
                sample);
    }

    private String normalizeResourceReference(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String reference = value.trim();
        if (reference.chars().anyMatch(Character::isISOControl)) {
            throw new InvalidRequestException("resourceReference must not include control characters.");
        }
        return reference;
    }

    private String normalizeUrl(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            URI uri = new URI(value.trim());
            String scheme = uri.getScheme();
            if (scheme == null || uri.getHost() == null
                    || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
                throw new InvalidRequestException("resourceUrl must be an absolute HTTP(S) URL.");
            }
            return uri.toASCIIString();
        } catch (URISyntaxException exception) {
            throw new InvalidRequestException("resourceUrl is not a valid URL.");
        }
    }

    private ResourceDtos.ResourceView view(ResourceRepository.ResourceActivity activity) {
        return view(activity.resource(), activity.accessCount(), activity.lastAccessed(), activity.attachmentCount());
    }

    private ResourceDtos.ResourceView view(Resource resource, long count, Instant lastAccessed) {
        return view(resource, count, lastAccessed, 0);
    }

    private ResourceDtos.ResourceView view(Resource resource, long count, Instant lastAccessed, long attachmentCount) {
        return new ResourceDtos.ResourceView(
                resource.id(), resource.title(), resource.description(), resource.category(), resource.resourceType(),
                resource.subject(), resource.academicTerm(), resource.resourceUrl(), resource.resourceReference(), resource.tags(), resource.createdAt(),
                resource.updatedAt(), resource.sample(), count, lastAccessed, attachmentCount);
    }

    private ResourceDtos.SearchMetricsView metrics(SplayTree.SearchStats stats, Instant searchedAt) {
        return new ResourceDtos.SearchMetricsView(stats.key, stats.found, stats.comparisons, stats.searchDepth,
                stats.rotations, stats.rootAfterSearch, searchedAt);
    }

    private static void validatePaging(int page, int size) {
        if (page < 0) {
            throw new InvalidRequestException("page must be zero or greater.");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new InvalidRequestException("size must be between 1 and " + MAX_PAGE_SIZE + ".");
        }
    }

    private static String normalizeSort(String value) {
        if (value == null || value.isBlank()) {
            return "id";
        }
        return switch (value) {
            case "id", "title", "createdAt", "updatedAt" -> value;
            default -> throw new InvalidRequestException("sort must be one of id, title, createdAt, updatedAt.");
        };
    }

    private static String normalizeDirection(String value) {
        if (value == null || value.isBlank() || value.equalsIgnoreCase("asc")) {
            return "asc";
        }
        if (value.equalsIgnoreCase("desc")) {
            return "desc";
        }
        throw new InvalidRequestException("direction must be asc or desc.");
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static void validateResourceId(int id) {
        if (id <= 0) {
            throw new InvalidRequestException("Resource ID must be a positive integer.");
        }
    }
}
