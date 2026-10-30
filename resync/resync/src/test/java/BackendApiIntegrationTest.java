import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = SmartContentManagerApplication.class)
@AutoConfigureMockMvc
class BackendApiIntegrationTest {
    private static final Path TEST_DB = Path.of("target/test-data/api-integration.db").toAbsolutePath();

    static {
        try {
            Files.createDirectories(TEST_DB.getParent());
            Files.deleteIfExists(TEST_DB);
            Files.deleteIfExists(Path.of(TEST_DB + "-wal"));
            Files.deleteIfExists(Path.of(TEST_DB + "-shm"));
        } catch (Exception exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }

    @DynamicPropertySource
    static void applicationProperties(DynamicPropertyRegistry registry) {
        registry.add("app.db.path", () -> TEST_DB.toString());
        registry.add("app.attachment.storage-dir", () -> "target/test-data/api-integration-attachments");
        registry.add("app.access-history-limit", () -> "20");
        registry.add("app.benchmark-report-path", () -> "out/benchmark-results.csv");
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SplayTree splayTree;

    @Test
    void healthEndpointIsAvailable() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.phase").value(1));
    }

    @Test
    void createLookupAndDeleteKeepDatabaseAndTreeInSync() throws Exception {
        int id = 98101;
        int lessPopularId = 98107;
        createResource(id, "Tree synchronization example").andExpect(status().isCreated());
        createResource(lessPopularId, "Less popular tree example").andExpect(status().isCreated());
        mockMvc.perform(get("/api/resources/{id}", lessPopularId)).andExpect(status().isOk());
        JsonNode before = json(mockMvc.perform(get("/api/dsa/splay-tree")).andReturn());
        int sizeBefore = before.get("size").asInt();

        mockMvc.perform(get("/api/resources/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resource.accessCount").value(1))
                .andExpect(jsonPath("$.search.found").value(true))
                .andExpect(jsonPath("$.search.comparisons").isNumber())
                .andExpect(jsonPath("$.search.rootAfterSearch").value(id))
                .andExpect(jsonPath("$.resource.resourceReference").value("references/" + id + ".pdf"));

        JsonNode afterAccess = json(mockMvc.perform(get("/api/dsa/splay-tree")).andReturn());
        assertEquals(id, afterAccess.get("rootId").asInt());
        assertEquals(id, afterAccess.get("lastAccessedResourceId").asInt());
        assertEquals(sizeBefore, afterAccess.get("size").asInt());
        assertTrue(containsNode(afterAccess, id));

        mockMvc.perform(get("/api/resources/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resource.accessCount").value(2));
        Map<String, Object> update = Map.of(
                "id", id,
                "title", "Updated tree synchronization example",
                "description", "Updated metadata without an additional access.",
                "category", "Lecture Notes",
                "resourceType", "PDF",
                "subject", "Computer Science",
                "academicTerm", "Year 2",
                "resourceReference", "references/" + id + ".pdf",
                "tags", List.of("updated"));
        mockMvc.perform(put("/api/resources/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated tree synchronization example"))
                .andExpect(jsonPath("$.accessCount").value(2));
        JsonNode popular = json(mockMvc.perform(get("/api/resources/popular?limit=100")).andReturn());
        int popularRank = indexOfResource(popular, id);
        int lessPopularRank = indexOfResource(popular, lessPopularId);
        assertTrue(popularRank >= 0 && lessPopularRank >= 0 && popularRank < lessPopularRank);
        assertEquals(2, popular.get(popularRank).get("resource").get("accessCount").asInt());

        mockMvc.perform(delete("/api/resources/{id}", id)).andExpect(status().isNoContent());
        JsonNode afterDelete = json(mockMvc.perform(get("/api/dsa/splay-tree")).andReturn());
        assertEquals(sizeBefore - 1, afterDelete.get("size").asInt());
        assertTrue(!containsNode(afterDelete, id));
        mockMvc.perform(get("/api/resources/{id}", id)).andExpect(status().isNotFound());
    }

    @Test
    void duplicateAndInvalidResourceDataUseConsistentErrors() throws Exception {
        int id = 98102;
        createResource(id, "Duplicate test").andExpect(status().isCreated());
        createResource(id, "Duplicate test").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_RESOURCE_ID"));

        Map<String, Object> invalid = Map.of(
                "id", 98103,
                "title", " ",
                "description", "Invalid title",
                "category", "Assignments",
                "resourceType", "PDF",
                "resourceUrl", "javascript:alert(1)");
        mockMvc.perform(post("/api/resources")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(invalid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void malformedScalarParametersAndNullWriteBodiesReturnBadRequest() throws Exception {
        mockMvc.perform(get("/api/resources").param("page", "not-a-number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        mockMvc.perform(get("/api/resources/not-an-integer"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        mockMvc.perform(get("/api/resources/0"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/resources")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("null"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    @Test
    void staleTreeKeyWithoutDatabaseRowDoesNotCountAsAnAccess() throws Exception {
        int staleId = 989998;
        long before = json(mockMvc.perform(get("/api/analytics/summary")).andReturn()).get("totalAccesses").asLong();
        splayTree.insert(staleId);
        try {
            mockMvc.perform(get("/api/resources/{id}", staleId))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.searchMetrics.found").value(true));
        } finally {
            assertTrue(splayTree.delete(staleId));
        }
        long after = json(mockMvc.perform(get("/api/analytics/summary")).andReturn()).get("totalAccesses").asLong();
        assertEquals(before, after);
        assertTrue(!containsNode(json(mockMvc.perform(get("/api/dsa/splay-tree")).andReturn()), staleId));
    }

    @Test
    void missingIdReturnsActualFailedSearchMetricsWithoutCountingAccess() throws Exception {
        long before = json(mockMvc.perform(get("/api/analytics/summary")).andReturn()).get("totalAccesses").asLong();
        mockMvc.perform(get("/api/resources/{id}", 989999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"))
                .andExpect(jsonPath("$.searchMetrics.found").value(false))
                .andExpect(jsonPath("$.searchMetrics.resourceId").value(989999));
        long after = json(mockMvc.perform(get("/api/analytics/summary")).andReturn()).get("totalAccesses").asLong();
        assertEquals(before, after);
    }

    @Test
    void titleSearchAndFiltersDoNotCountAsSplayAccesses() throws Exception {
        int id = 98104;
        createResource(id, "Searchable Graph Theory Notes").andExpect(status().isCreated());
        mockMvc.perform(get("/api/resources/search").param("q", "graph theory").param("category", "Lecture Notes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(id));
        mockMvc.perform(get("/api/resources").param("q", "Graph Theory").param("type", "PDF"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].accessCount").value(0));
    }

    @Test
    void recentActivityIsDistinctAndLatestSearchMetricsAreReal() throws Exception {
        int first = 98105;
        int second = 98106;
        createResource(first, "Recent first").andExpect(status().isCreated());
        createResource(second, "Recent second").andExpect(status().isCreated());
        mockMvc.perform(get("/api/resources/{id}", first)).andExpect(status().isOk());
        mockMvc.perform(get("/api/resources/{id}", second)).andExpect(status().isOk());
        mockMvc.perform(get("/api/resources/{id}", first)).andExpect(status().isOk());

        JsonNode recent = json(mockMvc.perform(get("/api/resources/recent").param("limit", "2")).andReturn());
        assertEquals(first, recent.get(0).get("resource").get("id").asInt());
        assertEquals(second, recent.get(1).get("resource").get("id").asInt());
        mockMvc.perform(get("/api/dsa/splay-tree/metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latestSearch.resourceId").value(first))
                .andExpect(jsonPath("$.latestSearch.found").value(true));
    }

    @Test
    void existingBenchmarkCsvIsServedAsValidatedRealRows() throws Exception {
        JsonNode report = json(mockMvc.perform(get("/api/analytics/benchmarks")).andReturn());
        assertTrue(report.get("available").asBoolean());
        assertEquals(12, report.get("rows").size());
        assertEquals("AVL Tree", report.get("rows").get(1).get("tree").asText());
    }

    private org.springframework.test.web.servlet.ResultActions createResource(int id, String title) throws Exception {
        Map<String, Object> request = Map.of(
                "id", id,
                "title", title,
                "description", "Test resource metadata.",
                "category", "Lecture Notes",
                "resourceType", "PDF",
                "subject", "Computer Science",
                "academicTerm", "Year 2",
                "resourceReference", "references/" + id + ".pdf",
                "tags", List.of("test", "dsa"));
        return mockMvc.perform(post("/api/resources")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(request)));
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private boolean containsNode(JsonNode snapshot, int id) {
        for (JsonNode node : snapshot.get("nodes")) {
            if (node.get("id").asInt() == id) {
                return true;
            }
        }
        return false;
    }

    private int indexOfResource(JsonNode list, int id) {
        for (int index = 0; index < list.size(); index++) {
            if (list.get(index).get("resource").get("id").asInt() == id) {
                return index;
            }
        }
        return -1;
    }
}
