import jakarta.validation.constraints.Positive;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api")
@Validated
public class ResourceAttachmentController {
    private static final String CONTENT_ROUTE = "/resources/{resourceId}/attachments/{attachmentId}/content";

    private final AttachmentService attachments;

    public ResourceAttachmentController(AttachmentService attachments) {
        this.attachments = attachments;
    }

    @GetMapping("/attachments/policy")
    public ResourceDtos.AttachmentPolicyView policy() {
        return attachments.policy();
    }

    @GetMapping("/resources/{resourceId}/attachments")
    public List<ResourceDtos.AttachmentView> list(@PathVariable @Positive int resourceId) {
        return attachments.list(resourceId);
    }

    @PostMapping(value = "/resources/{resourceId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ResourceDtos.AttachmentView> upload(
            @PathVariable @Positive int resourceId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestPart("file") MultipartFile file) {
        AttachmentService.UploadResult result = attachments.upload(resourceId, file, idempotencyKey);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.attachment());
    }

    @RequestMapping(value = CONTENT_ROUTE, method = RequestMethod.HEAD)
    public ResponseEntity<Void> headContent(
            @PathVariable @Positive int resourceId,
            @PathVariable @Positive int attachmentId) {
        AttachmentService.AttachmentFile file = attachments.file(resourceId, attachmentId);
        ContentDisposition disposition = ContentDisposition.inline().filename(file.filename(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(file.sizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .build();
    }

    @GetMapping(CONTENT_ROUTE)
    public ResponseEntity<FileSystemResource> content(
            @PathVariable @Positive int resourceId,
            @PathVariable @Positive int attachmentId) {
        return fileResponse(resourceId, attachmentId, false);
    }

    @GetMapping("/resources/{resourceId}/attachments/{attachmentId}/download")
    public ResponseEntity<FileSystemResource> download(
            @PathVariable @Positive int resourceId,
            @PathVariable @Positive int attachmentId) {
        return fileResponse(resourceId, attachmentId, true);
    }

    @DeleteMapping("/resources/{resourceId}/attachments/{attachmentId}")
    public ResponseEntity<Void> delete(
            @PathVariable @Positive int resourceId,
            @PathVariable @Positive int attachmentId) {
        attachments.delete(resourceId, attachmentId);
        return ResponseEntity.noContent().build();
    }

    private ResponseEntity<FileSystemResource> fileResponse(int resourceId, int attachmentId, boolean download) {
        AttachmentService.AttachmentFile file = attachments.file(resourceId, attachmentId);
        ContentDisposition disposition = download
                ? ContentDisposition.attachment().filename(file.filename(), StandardCharsets.UTF_8).build()
                : ContentDisposition.inline().filename(file.filename(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .contentLength(file.sizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(new FileSystemResource(file.path()));
    }
}
