import java.time.Instant;
import java.util.List;

public record Resource(
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
        boolean sample) {

    public Resource {
        resourceReference = resourceReference == null ? "" : resourceReference;
        tags = tags == null ? List.of() : List.copyOf(tags);
    }
}
