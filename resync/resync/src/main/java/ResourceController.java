import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api")
@Validated
public class ResourceController {
    private final CatalogService catalog;

    public ResourceController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("status", "ok", "service", "smart-content-manager-api", "phase", 1, "checkedAt", Instant.now());
    }

    @GetMapping("/resources")
    public ResourceDtos.ResourcePageView list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(name = "type", required = false) String resourceType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "id") String sort,
            @RequestParam(defaultValue = "asc") String direction) {
        return catalog.listResources(q, category, resourceType, page, size, sort, direction);
    }

    @GetMapping("/resources/search")
    public ResourceDtos.ResourcePageView search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(name = "type", required = false) String resourceType,
            @RequestParam(defaultValue = "50") int limit) {
        return catalog.searchResources(q, category, resourceType, limit);
    }

    @GetMapping("/resources/{id}")
    public ResourceDtos.ResourceLookupView byId(@PathVariable @Positive int id) {
        return catalog.accessById(id);
    }

    @PostMapping("/resources")
    public ResponseEntity<ResourceDtos.ResourceView> create(@Valid @RequestBody ResourceDtos.ResourceWriteRequest request) {
        if (request == null) {
            throw new InvalidRequestException("Request body must be a JSON object.");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(catalog.create(request));
    }

    @PutMapping("/resources/{id}")
    public ResourceDtos.ResourceView update(
            @PathVariable @Positive int id,
            @Valid @RequestBody ResourceDtos.ResourceWriteRequest request) {
        if (request == null) {
            throw new InvalidRequestException("Request body must be a JSON object.");
        }
        return catalog.update(id, request);
    }

    @DeleteMapping("/resources/{id}")
    public ResponseEntity<Void> delete(@PathVariable @Positive int id) {
        catalog.delete(id);
        return ResponseEntity.noContent().build();
    }
}
