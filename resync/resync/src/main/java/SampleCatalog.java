import java.time.Instant;
import java.util.List;

public final class SampleCatalog {
    private static final String NOTE = "Demonstration sample only; not an official university document.";

    private SampleCatalog() {
    }

    public static List<Resource> resources() {
        Instant now = Instant.now();
        return List.of(
                sample(1001, "Introduction to Data Structures — Lecture Notes", "Unit 1–2 overview covering arrays, lists, stacks, queues and complexity. " + NOTE, "Lecture Notes", "PDF", "Computer Science", "Year 2 · Semester 1", List.of("dsa", "lecture", "unit-1"), now),
                sample(1002, "Database Systems — Lab Manual", "Practice sequence for relational queries and schema exercises. " + NOTE, "Laboratory Manuals", "PDF", "Computer Science", "Year 2 · Semester 2", List.of("database", "lab"), now),
                sample(1003, "Algorithms Assignment — Problem Set 2", "Illustrative assignment brief with submission checklist. " + NOTE, "Assignments", "Document", "Computer Science", "Year 2 · Semester 1", List.of("algorithms", "assignment"), now),
                sample(1004, "Engineering Mathematics — Weekly Timetable", "Example timetable data for a sample academic week. " + NOTE, "Timetables", "Spreadsheet", "Engineering", "Year 1 · Semester 2", List.of("timetable", "maths"), now),
                sample(1005, "Midterm Examination — Preparation Notice", "Example notice showing date, room and permitted-material fields. " + NOTE, "Examination Resources", "Notice", "Computer Science", "Year 2 · Semester 1", List.of("exam", "notice"), now),
                sample(1006, "Campus Library — Referencing Guide", "Demonstration reference guide describing citation sections. " + NOTE, "Reference Materials", "Guide", "Library Services", "All years", List.of("library", "reference"), now),
                sample(1007, "Laboratory Safety — General Notice", "Example checklist for preparing a teaching laboratory. " + NOTE, "Notices", "Notice", "Engineering", "All years", List.of("safety", "lab"), now)
        );
    }

    private static Resource sample(
            int id,
            String title,
            String description,
            String category,
            String type,
            String subject,
            String term,
            List<String> tags,
            Instant timestamp) {
        return new Resource(id, title, description, category, type, subject, term, null, null, tags, timestamp, timestamp, true);
    }
}
