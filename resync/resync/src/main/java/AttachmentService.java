import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public class AttachmentService {
    public record AttachmentFile(Path path, String filename, long sizeBytes, String contentType) {
    }

    public record UploadResult(ResourceDtos.AttachmentView attachment, boolean created) {
    }

    private final ResourceRepository resources;
    private final AttachmentRepository attachments;
    private final AttachmentStorage storage;
    private final long maxFileSizeBytes;

    public AttachmentService(
            ResourceRepository resources,
            AttachmentRepository attachments,
            AttachmentStorage storage,
            long maxFileSizeBytes) {
        if (maxFileSizeBytes <= 0) {
            throw new IllegalArgumentException("APP_ATTACHMENT_MAX_FILE_SIZE must be greater than zero.");
        }
        this.resources = resources;
        this.attachments = attachments;
        this.storage = storage;
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    public ResourceDtos.AttachmentPolicyView policy() {
        return new ResourceDtos.AttachmentPolicyView(maxFileSizeBytes, "application/pdf", 1);
    }

    @Transactional(readOnly = true)
    public List<ResourceDtos.AttachmentView> list(int resourceId) {
        requireResource(resourceId);
        return attachments.findByResourceId(resourceId).stream().map(AttachmentService::view).toList();
    }

    @Transactional
    public UploadResult upload(int resourceId, MultipartFile file, String suppliedIdempotencyKey) {
        requireResource(resourceId);
        String idempotencyKey = normalizeIdempotencyKey(suppliedIdempotencyKey);
        if (file == null || file.isEmpty() || file.getSize() <= 0) {
            throw new InvalidAttachmentException("Choose a non-empty PDF file to upload.");
        }
        if (file.getSize() > maxFileSizeBytes) {
            throw new AttachmentTooLargeException(maxFileSizeBytes);
        }

        String originalFilename = sanitizeFilename(file.getOriginalFilename());
        String claimedType = file.getContentType();
        if (StringUtils.hasText(claimedType)
                && !"application/pdf".equalsIgnoreCase(claimedType.trim())
                && !"application/octet-stream".equalsIgnoreCase(claimedType.trim())) {
            throw new InvalidAttachmentException("Only PDF documents can be uploaded.");
        }

        Path stagedFile = null;
        String storageKey = null;
        boolean metadataInserted = false;
        try {
            stagedFile = storage.createTemporaryFile();
            try (InputStream input = file.getInputStream()) {
                Files.copy(input, stagedFile, StandardCopyOption.REPLACE_EXISTING);
            }
            long actualSize = Files.size(stagedFile);
            if (actualSize <= 0) {
                throw new InvalidAttachmentException("The selected file is empty.");
            }
            if (actualSize > maxFileSizeBytes) {
                throw new AttachmentTooLargeException(maxFileSizeBytes);
            }
            validatePdf(stagedFile);
            String contentSha256 = sha256(stagedFile);

            ResourceAttachment existing = attachments.findByIdempotencyKey(idempotencyKey).orElse(null);
            if (existing != null) {
                if (existing.resourceId() != resourceId
                        || !existing.originalFilename().equals(originalFilename)
                        || existing.sizeBytes() != actualSize
                        || !contentSha256.equals(existing.contentSha256())) {
                    throw new AttachmentIdempotencyConflictException();
                }
                ensureStoredCopy(existing, stagedFile, actualSize, contentSha256);
                return new UploadResult(view(existing), false);
            }

            storageKey = storage.newStorageKey();
            storage.store(stagedFile, storageKey);
            ResourceAttachment inserted = attachments.insert(new ResourceAttachment(
                    0,
                    resourceId,
                    storageKey,
                    originalFilename,
                    actualSize,
                    "application/pdf",
                    contentSha256,
                    idempotencyKey,
                    Instant.now()));
            metadataInserted = true;
            cleanupFileOnRollback(storageKey);
            return new UploadResult(view(inserted), true);
        } catch (InvalidAttachmentException | AttachmentTooLargeException | AttachmentIdempotencyConflictException exception) {
            throw exception;
        } catch (DataAccessException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new AttachmentStorageException("The PDF could not be stored. Check the configured local storage directory.", exception);
        } finally {
            storage.deleteTemporaryQuietly(stagedFile);
            if (storageKey != null && !metadataInserted) {
                storage.deleteQuietly(storageKey);
            }
        }
    }

    @Transactional(readOnly = true)
    public AttachmentFile file(int resourceId, int attachmentId) {
        requireResource(resourceId);
        ResourceAttachment attachment = findAttachment(resourceId, attachmentId);
        Path file = storage.readableFile(attachment.storageKey());
        if (file == null) {
            throw new AttachmentFileMissingException();
        }
        try {
            long actualSize = Files.size(file);
            if (actualSize != attachment.sizeBytes()) {
                throw new AttachmentStorageException("The stored PDF failed its metadata integrity check.");
            }
            return new AttachmentFile(file, attachment.originalFilename(), actualSize, "application/pdf");
        } catch (IOException exception) {
            throw new AttachmentStorageException("The stored PDF could not be read.", exception);
        }
    }

    @Transactional
    public void delete(int resourceId, int attachmentId) {
        requireResource(resourceId);
        ResourceAttachment attachment = findAttachment(resourceId, attachmentId);
        if (!attachments.deleteById(resourceId, attachmentId)) {
            throw new AttachmentNotFoundException(resourceId, attachmentId);
        }
        cleanupFileAfterCommit(attachment.storageKey());
    }

    @Transactional
    public void deleteForResource(int resourceId) {
        List<ResourceAttachment> existing = attachments.deleteByResourceId(resourceId);
        List<String> storageKeys = existing.stream().map(ResourceAttachment::storageKey).toList();
        if (!storageKeys.isEmpty()) {
            cleanupFilesAfterCommit(storageKeys);
        }
    }

    private void ensureStoredCopy(ResourceAttachment existing, Path stagedFile, long sizeBytes, String contentSha256) throws IOException {
        Path stored = storage.readableFile(existing.storageKey());
        boolean validStoredFile = false;
        if (stored != null && Files.size(stored) == sizeBytes) {
            validStoredFile = contentSha256.equals(sha256(stored));
        }
        if (!validStoredFile) {
            storage.delete(existing.storageKey());
            storage.store(stagedFile, existing.storageKey());
        }
    }

    private void requireResource(int resourceId) {
        if (resourceId <= 0) {
            throw new InvalidRequestException("Resource ID must be a positive integer.");
        }
        if (resources.findById(resourceId).isEmpty()) {
            throw new ResourceNotFoundException(resourceId, null);
        }
    }

    private ResourceAttachment findAttachment(int resourceId, int attachmentId) {
        if (attachmentId <= 0) {
            throw new InvalidRequestException("Attachment ID must be a positive integer.");
        }
        return attachments.findById(resourceId, attachmentId)
                .orElseThrow(() -> new AttachmentNotFoundException(resourceId, attachmentId));
    }

    private static String normalizeIdempotencyKey(String supplied) {
        if (!StringUtils.hasText(supplied)) {
            return UUID.randomUUID().toString();
        }
        String normalized = supplied.trim().toLowerCase(Locale.ROOT);
        try {
            UUID parsed = UUID.fromString(normalized);
            if (!parsed.toString().equals(normalized)) {
                throw new InvalidAttachmentException("The upload idempotency key must be a UUID.");
            }
            return normalized;
        } catch (IllegalArgumentException exception) {
            throw new InvalidAttachmentException("The upload idempotency key must be a UUID.");
        }
    }

    private static ResourceDtos.AttachmentView view(ResourceAttachment attachment) {
        return new ResourceDtos.AttachmentView(
                attachment.id(),
                attachment.resourceId(),
                attachment.originalFilename(),
                attachment.sizeBytes(),
                attachment.contentType(),
                attachment.uploadedAt());
    }

    private static String sanitizeFilename(String rawFilename) {
        if (!StringUtils.hasText(rawFilename)) {
            throw new InvalidAttachmentException("The PDF filename is missing.");
        }
        String portable = rawFilename.replace('\\', '/');
        int slash = portable.lastIndexOf('/');
        String basename = slash >= 0 ? portable.substring(slash + 1) : portable;
        String safe = Normalizer.normalize(basename, Normalizer.Form.NFC)
                .replaceAll("[\\p{Cc}]", " ")
                .replaceAll("[\\/:*?\"<>|]", "_")
                .trim();
        if (safe.isEmpty() || !safe.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            throw new InvalidAttachmentException("Choose a file with a .pdf filename.");
        }
        if (safe.length() > 200) {
            safe = safe.substring(0, 196) + ".pdf";
        }
        return safe;
    }

    private static void validatePdf(Path file) {
        try (PDDocument document = Loader.loadPDF(file.toFile())) {
            if (document.getNumberOfPages() < 1) {
                throw new InvalidAttachmentException("The PDF must contain at least one readable page.");
            }
        } catch (IOException exception) {
            throw new InvalidAttachmentException("The file contents are not a readable PDF document.");
        }
    }

    private static String sha256(Path file) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = Files.newInputStream(file)) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) >= 0) {
                    if (count > 0) digest.update(buffer, 0, count);
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable in this Java runtime.", exception);
        }
    }

    private void cleanupFileOnRollback(String storageKey) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    storage.deleteQuietly(storageKey);
                }
            }
        });
    }

    private void cleanupFileAfterCommit(String storageKey) {
        cleanupFilesAfterCommit(List.of(storageKey));
    }

    private void cleanupFilesAfterCommit(List<String> storageKeys) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            storageKeys.forEach(storage::deleteQuietly);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                storageKeys.forEach(storage::deleteQuietly);
            }
        });
    }
}
