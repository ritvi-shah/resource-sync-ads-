import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import java.util.regex.Pattern;

public final class AttachmentStorage {
    private static final Logger LOGGER = LoggerFactory.getLogger(AttachmentStorage.class);
    private static final Pattern GENERATED_KEY = Pattern.compile(
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.pdf");
    private static final String TEMP_PREFIX = ".campus-index-upload-";

    private final Path root;

    public AttachmentStorage(String directory) {
        if (!StringUtils.hasText(directory)) {
            throw new IllegalArgumentException("APP_ATTACHMENT_STORAGE_DIR must name a directory.");
        }
        try {
            Path configured = Path.of(directory.trim()).toAbsolutePath().normalize();
            Files.createDirectories(configured);
            this.root = configured.toRealPath();
        } catch (IOException | RuntimeException exception) {
            throw new IllegalStateException("The configured PDF storage directory is unavailable.", exception);
        }
    }

    public Path createTemporaryFile() throws IOException {
        return Files.createTempFile(root, TEMP_PREFIX, ".tmp");
    }

    public String newStorageKey() {
        return UUID.randomUUID().toString() + ".pdf";
    }

    public Path store(Path stagedFile, String storageKey) throws IOException {
        Path target = resolve(storageKey);
        if (stagedFile == null || !root.equals(stagedFile.toAbsolutePath().normalize().getParent())) {
            throw new AttachmentStorageException("The staged PDF is outside the configured storage directory.");
        }
        try {
            return Files.move(stagedFile, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException exception) {
            return Files.move(stagedFile, target);
        }
    }

    public Path readableFile(String storageKey) {
        Path file = resolve(storageKey);
        if (Files.isSymbolicLink(file) || !Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) {
            return null;
        }
        return file;
    }

    public void delete(String storageKey) throws IOException {
        Files.deleteIfExists(resolve(storageKey));
    }

    public void deleteQuietly(String storageKey) {
        try {
            delete(storageKey);
        } catch (IOException | RuntimeException exception) {
            LOGGER.warn("Could not remove a generated PDF file during attachment cleanup.");
        }
    }

    public void deleteTemporaryQuietly(Path temporaryFile) {
        if (temporaryFile == null) {
            return;
        }
        Path normalized = temporaryFile.toAbsolutePath().normalize();
        if (!root.equals(normalized.getParent()) || !normalized.getFileName().toString().startsWith(TEMP_PREFIX)) {
            return;
        }
        try {
            Files.deleteIfExists(normalized);
        } catch (IOException | RuntimeException exception) {
            LOGGER.warn("Could not remove a staged PDF after an unsuccessful upload.");
        }
    }

    private Path resolve(String storageKey) {
        if (storageKey == null || !GENERATED_KEY.matcher(storageKey).matches()) {
            throw new AttachmentStorageException("The stored attachment identifier is invalid.");
        }
        Path resolved = root.resolve(storageKey).normalize();
        if (!resolved.startsWith(root) || resolved.equals(root)) {
            throw new AttachmentStorageException("The stored attachment identifier is invalid.");
        }
        return resolved;
    }
}
