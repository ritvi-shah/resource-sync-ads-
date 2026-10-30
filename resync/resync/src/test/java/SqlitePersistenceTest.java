import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SqlitePersistenceTest {
    @Test
    void resourcesAndAccessEventsSurviveRepositoryRecreation(@TempDir Path tempDir) {
        Path database = tempDir.resolve("persistence.db");
        SqliteResourceRepository first = new SqliteResourceRepository(new JdbcTemplate(dataSource(database)), new ObjectMapper());
        int id = 99101;
        Instant firstAccess = Instant.parse("2026-01-01T10:00:00Z");
        Instant secondAccess = Instant.parse("2026-01-01T10:00:00.500Z");
        first.insert(new Resource(id, "Persistent note", "A test resource", "Lecture Notes", "PDF", "Computer Science",
                "Year 2", null, "archive/notes/persistent-note.pdf", List.of("persistence"), firstAccess, firstAccess, false));
        first.insertAccessEvent(id, secondAccess);
        first.insertAccessEvent(id, firstAccess);

        SqliteResourceRepository afterRestart = new SqliteResourceRepository(new JdbcTemplate(dataSource(database)), new ObjectMapper());
        assertTrue(afterRestart.findById(id).isPresent());
        assertEquals("archive/notes/persistent-note.pdf", afterRestart.findById(id).orElseThrow().resourceReference());
        assertEquals(2, afterRestart.accessCount(id));
        assertEquals(secondAccess, afterRestart.lastAccessed(id).orElseThrow());

        AccessTracker tracker = new AccessTracker(20);
        afterRestart.findAllAccessEventsChronologically()
                .forEach(event -> tracker.recordAccessAt(event.resourceId(), event.accessedAt()));
        assertEquals(2, tracker.getAccessCount(id));
        assertEquals(id, tracker.getRecentAccesses().getFirst());
        assertEquals(secondAccess, tracker.getLastAccessed(id));

        SplayTree restoredTree = new SplayTree();
        afterRestart.findPage(null, null, null, 0, Integer.MAX_VALUE, "id", "asc")
                .forEach(row -> restoredTree.insert(row.resource().id()));
        assertTrue(restoredTree.search(id));
        assertEquals(id, restoredTree.getRootKey());
    }

    @Test
    void upgradesExistingCatalogWithoutDroppingRows(@TempDir Path tempDir) {
        Path database = tempDir.resolve("legacy-schema.db");
        JdbcTemplate jdbc = new JdbcTemplate(dataSource(database));
        jdbc.execute("CREATE TABLE resources (id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', "
                + "category TEXT NOT NULL, resource_type TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '', "
                + "academic_term TEXT NOT NULL DEFAULT '', resource_url TEXT, tags_json TEXT NOT NULL DEFAULT '[]', "
                + "created_at TEXT NOT NULL, updated_at TEXT NOT NULL, is_sample INTEGER NOT NULL DEFAULT 0)");
        int id = 99102;
        Instant timestamp = Instant.parse("2026-01-02T10:00:00Z");
        String encodedTimestamp = TimeCodec.format(timestamp);
        jdbc.update("INSERT INTO resources(id,title,description,category,resource_type,subject,academic_term,resource_url,tags_json,created_at,updated_at,is_sample) "
                        + "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                id, "Legacy resource", "Before reference migration", "Lecture Notes", "PDF", "Computer Science", "Year 2",
                null, "[]", encodedTimestamp, encodedTimestamp, 0);

        SqliteResourceRepository migrated = new SqliteResourceRepository(jdbc, new ObjectMapper());
        Resource legacy = migrated.findById(id).orElseThrow();
        assertEquals("Legacy resource", legacy.title());
        assertEquals("", legacy.resourceReference());
        Resource updated = new Resource(legacy.id(), legacy.title(), legacy.description(), legacy.category(), legacy.resourceType(),
                legacy.subject(), legacy.academicTerm(), legacy.resourceUrl(), "archive/legacy-resource.pdf", legacy.tags(),
                legacy.createdAt(), timestamp.plusSeconds(1), false);
        assertTrue(migrated.update(updated));
        assertEquals("archive/legacy-resource.pdf", migrated.findById(id).orElseThrow().resourceReference());
    }

    private DriverManagerDataSource dataSource(Path file) {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.sqlite.JDBC");
        dataSource.setUrl("jdbc:sqlite:" + file.toAbsolutePath());
        return dataSource;
    }
}
