import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = SmartContentManagerApplication.class)
@AutoConfigureMockMvc
class AttachmentApiIntegrationTest {
    private static final Path TEST_DB = Path.of("target/test-data/attachment-api.db").toAbsolutePath();
    private static final Path TEST_STORAGE = Path.of("target/test-data/attachment-api-files").toAbsolutePath();

    static {
        try {
            Files.createDirectories(TEST_DB.getParent());
            Files.deleteIfExists(TEST_DB);
            Files.deleteIfExists(Path.of(TEST_DB + "-wal"));
            Files.deleteIfExists(Path.of(TEST_DB + "-shm"));
            deleteTree(TEST_STORAGE);
        } catch (Exception exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }

    @DynamicPropertySource
    static void applicationProperties(DynamicPropertyRegistry registry) {
        registry.add("app.db.path", () -> TEST_DB.toString());
        registry.add("app.attachment.storage-dir", () -> TEST_STORAGE.toString());
        registry.add("app.attachment.max-file-size", () -> "2KB");
        registry.add("spring.servlet.multipart.max-file-size", () -> "4MB");
        registry.add("spring.servlet.multipart.max-request-size", () -> "5MB");
        registry.add("app.access-history-limit", () -> "20");
        registry.add("app.benchmark-report-path", () -> "out/benchmark-results.csv");
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void uploadsListsServesDownloadsAndDeletesMultipleActualPdfsWithoutCountingAccesses() throws Exception {
        int resourceId = 98601;
        createResource(resourceId, "PDF attachment workflow");
        JsonNode before = json(mockMvc.perform(get("/api/analytics/summary")).andReturn());
        JsonNode treeBefore = json(mockMvc.perform(get("/api/dsa/splay-tree")).andReturn());
        Set<Path> storedBeforeFirstUpload = storedPdfs();
        byte[] firstPdf = validPdf();
        byte[] secondPdf = validPdf();

        JsonNode first = json(upload(resourceId, "C:\\fakepath\\lecture-notes.pdf", MediaType.APPLICATION_PDF_VALUE, firstPdf)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.contentType").value("application/pdf"))
                .andExpect(jsonPath("$.originalFilename").value("lecture-notes.pdf"))
                .andExpect(jsonPath("$.sizeBytes").value(firstPdf.length))
                .andExpect(jsonPath("$.storageKey").doesNotExist())
                .andExpect(jsonPath("$.path").doesNotExist())
                .andReturn());
        Path firstStoredFile = storedPdfs().stream().filter(path -> !storedBeforeFirstUpload.contains(path)).findFirst().orElseThrow();
        JsonNode second = json(upload(resourceId, "slides.pdf", MediaType.APPLICATION_PDF_VALUE, secondPdf)
                .andExpect(status().isCreated())
                .andReturn());

        mockMvc.perform(get("/api/attachments/policy"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxFileSizeBytes").value(2048))
                .andExpect(jsonPath("$.contentType").value("application/pdf"))
                .andExpect(jsonPath("$.maxFilesPerRequest").value(1));
        MvcResult listResult = mockMvc.perform(get("/api/resources/{resourceId}/attachments", resourceId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(first.get("id").asInt()))
                .andExpect(jsonPath("$[1].id").value(second.get("id").asInt()))
                .andExpect(jsonPath("$[0].storageKey").doesNotExist())
                .andReturn();
        assertEquals(2, objectMapper.readTree(listResult.getResponse().getContentAsByteArray()).size());

        MvcResult inline = mockMvc.perform(get("/api/resources/{resourceId}/attachments/{attachmentId}/content", resourceId, first.get("id").asInt()))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("inline")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andReturn();
        assertArrayEquals(firstPdf, inline.getResponse().getContentAsByteArray());

        mockMvc.perform(head("/api/resources/{resourceId}/attachments/{attachmentId}/content", resourceId, first.get("id").asInt()))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().longValue("Content-Length", firstPdf.length));

        MvcResult download = mockMvc.perform(get("/api/resources/{resourceId}/attachments/{attachmentId}/download", resourceId, first.get("id").asInt()))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")))
                .andReturn();
        assertArrayEquals(firstPdf, download.getResponse().getContentAsByteArray());

        mockMvc.perform(delete("/api/resources/{resourceId}/attachments/{attachmentId}", resourceId, first.get("id").asInt()))
                .andExpect(status().isNoContent());
        assertFalse(Files.exists(firstStoredFile));
        mockMvc.perform(get("/api/resources/{resourceId}/attachments", resourceId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get("/api/resources/{resourceId}/attachments/{attachmentId}/content", resourceId, 999999))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ATTACHMENT_NOT_FOUND"));
        JsonNode resourcePage = json(mockMvc.perform(get("/api/resources").param("q", "PDF attachment workflow")).andReturn());
        assertEquals(1, resourcePage.get("items").get(0).get("attachmentCount").asInt());

        JsonNode after = json(mockMvc.perform(get("/api/analytics/summary")).andReturn());
        JsonNode treeAfter = json(mockMvc.perform(get("/api/dsa/splay-tree")).andReturn());
        assertEquals(before.get("totalAccesses").asLong(), after.get("totalAccesses").asLong());
        assertEquals(treeBefore.get("rootId"), treeAfter.get("rootId"));
        assertEquals(treeBefore.get("size"), treeAfter.get("size"));
    }

    @Test
    void sameIdempotencyKeyReplaysSuccessfulUploadWithoutDuplicateAndRejectsDifferentContent() throws Exception {
        int resourceId = 98605;
        createResource(resourceId, "Idempotent upload workflow");
        byte[] originalPdf = validPdf("same content");
        String token = UUID.randomUUID().toString();
        Set<Path> before = storedPdfs();

        JsonNode first = json(uploadWithKey(resourceId, "notes.pdf", MediaType.APPLICATION_PDF_VALUE, originalPdf, token)
                .andExpect(status().isCreated())
                .andReturn());
        JsonNode replay = json(uploadWithKey(resourceId, "notes.pdf", MediaType.APPLICATION_PDF_VALUE, originalPdf, token)
                .andExpect(status().isOk())
                .andReturn());

        assertEquals(first.get("id").asInt(), replay.get("id").asInt());
        assertEquals(1, storedPdfs().stream().filter(path -> !before.contains(path)).count());
        mockMvc.perform(get("/api/resources/{resourceId}/attachments", resourceId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        uploadWithKey(resourceId, "notes.pdf", MediaType.APPLICATION_PDF_VALUE, validPdf("different content"), token)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ATTACHMENT_IDEMPOTENCY_CONFLICT"));
        assertEquals(1, storedPdfs().stream().filter(path -> !before.contains(path)).count());
        mockMvc.perform(get("/api/resources/{resourceId}/attachments", resourceId))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void rejectsMalformedUnsupportedAndOversizedFilesWithStructuredErrors() throws Exception {
        int resourceId = 98602;
        createResource(resourceId, "PDF validation workflow");

        upload(resourceId, "broken.pdf", MediaType.APPLICATION_PDF_VALUE, "not a PDF".getBytes(StandardCharsets.UTF_8))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ATTACHMENT"));
        upload(resourceId, "renamed.txt", MediaType.APPLICATION_PDF_VALUE, validPdf())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ATTACHMENT"));
        upload(resourceId, "too-large.pdf", MediaType.APPLICATION_PDF_VALUE, new byte[2049])
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("ATTACHMENT_TOO_LARGE"))
                .andExpect(jsonPath("$.details.maxFileSizeBytes").value("2048"));
        upload(resourceId, "parser-too-large.pdf", MediaType.APPLICATION_PDF_VALUE, new byte[4 * 1024 * 1024 + 1])
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("ATTACHMENT_TOO_LARGE"))
                .andExpect(jsonPath("$.details.maxFileSizeBytes").value("2048"));
        mockMvc.perform(get("/api/resources/{resourceId}/attachments", resourceId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void missingStoredBytesReturnStructuredNotFoundAndCanStillBeRemoved() throws Exception {
        int resourceId = 98603;
        createResource(resourceId, "Missing PDF workflow");
        Set<Path> before = storedPdfs();
        JsonNode attachment = json(upload(resourceId, "missing-after-upload.pdf", MediaType.APPLICATION_PDF_VALUE, validPdf())
                .andExpect(status().isCreated())
                .andReturn());
        Path storedFile = storedPdfs().stream().filter(path -> !before.contains(path)).findFirst().orElseThrow();
        Files.delete(storedFile);

        mockMvc.perform(get("/api/resources/{resourceId}/attachments/{attachmentId}/content", resourceId, attachment.get("id").asInt())
                        .accept(MediaType.APPLICATION_PDF))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ATTACHMENT_FILE_MISSING"))
                .andExpect(jsonPath("$.message").value("The PDF file is no longer available in local storage."));
        mockMvc.perform(delete("/api/resources/{resourceId}/attachments/{attachmentId}", resourceId, attachment.get("id").asInt()))
                .andExpect(status().isNoContent());
    }

    @Test
    void deletingResourceRemovesAttachmentMetadataAndGeneratedFiles() throws Exception {
        int resourceId = 98604;
        createResource(resourceId, "Resource cleanup workflow");
        Set<Path> before = storedPdfs();
        upload(resourceId, "cleanup.pdf", MediaType.APPLICATION_PDF_VALUE, validPdf())
                .andExpect(status().isCreated());
        Path storedFile = storedPdfs().stream().filter(path -> !before.contains(path)).findFirst().orElseThrow();
        JsonNode page = json(mockMvc.perform(get("/api/resources").param("q", "Resource cleanup workflow")).andReturn());
        assertEquals(1, page.get("items").get(0).get("attachmentCount").asInt());

        mockMvc.perform(delete("/api/resources/{resourceId}", resourceId)).andExpect(status().isNoContent());
        assertFalse(Files.exists(storedFile));
        mockMvc.perform(get("/api/resources/{resourceId}/attachments", resourceId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    private org.springframework.test.web.servlet.ResultActions upload(int resourceId, String filename, String contentType, byte[] bytes) throws Exception {
        return uploadWithKey(resourceId, filename, contentType, bytes, UUID.randomUUID().toString());
    }

    private org.springframework.test.web.servlet.ResultActions uploadWithKey(
            int resourceId, String filename, String contentType, byte[] bytes, String idempotencyKey) throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", filename, contentType, bytes);
        return mockMvc.perform(multipart("/api/resources/{resourceId}/attachments", resourceId)
                .file(file)
                .header("Idempotency-Key", idempotencyKey));
    }

    private void createResource(int id, String title) throws Exception {
        Map<String, Object> request = Map.of(
                "id", id,
                "title", title,
                "description", "A test catalogue record.",
                "category", "Lecture Notes",
                "resourceType", "PDF",
                "subject", "Computer Science",
                "academicTerm", "Year 2",
                "tags", List.of("attachment-test"));
        mockMvc.perform(post("/api/resources")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isCreated());
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private Set<Path> storedPdfs() throws Exception {
        if (!Files.exists(TEST_STORAGE)) return Set.of();
        try (Stream<Path> paths = Files.list(TEST_STORAGE)) {
            return Set.copyOf(paths.filter(path -> path.getFileName().toString().endsWith(".pdf")).toList());
        }
    }

    private static byte[] validPdf() throws Exception {
        return validPdf("test");
    }

    private static byte[] validPdf(String title) throws Exception {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            document.addPage(new PDPage());
            document.getDocumentInformation().setTitle(title);
            document.save(output);
            return output.toByteArray();
        }
    }

    private static void deleteTree(Path directory) throws Exception {
        if (!Files.exists(directory)) return;
        try (Stream<Path> paths = Files.walk(directory)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        }
    }
}
