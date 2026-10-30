import java.util.Map;

class ResourceNotFoundException extends RuntimeException {
    private final int resourceId;
    private final ResourceDtos.SearchMetricsView searchMetrics;

    ResourceNotFoundException(int resourceId, ResourceDtos.SearchMetricsView searchMetrics) {
        super("Resource " + resourceId + " was not found.");
        this.resourceId = resourceId;
        this.searchMetrics = searchMetrics;
    }

    int resourceId() {
        return resourceId;
    }

    ResourceDtos.SearchMetricsView searchMetrics() {
        return searchMetrics;
    }

    Map<String, String> details() {
        return Map.of("resourceId", Integer.toString(resourceId));
    }
}

class DuplicateResourceException extends RuntimeException {
    private final int resourceId;

    DuplicateResourceException(int resourceId) {
        super("Resource ID " + resourceId + " already exists.");
        this.resourceId = resourceId;
    }

    int resourceId() {
        return resourceId;
    }
}

class InvalidRequestException extends RuntimeException {
    InvalidRequestException(String message) {
        super(message);
    }
}
