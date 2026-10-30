import java.util.Map;

class InvalidAttachmentException extends RuntimeException {
    InvalidAttachmentException(String message) {
        super(message);
    }
}

class AttachmentTooLargeException extends RuntimeException {
    private final long maxFileSizeBytes;

    AttachmentTooLargeException(long maxFileSizeBytes) {
        super("The PDF exceeds the configured maximum file size.");
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    long maxFileSizeBytes() {
        return maxFileSizeBytes;
    }

    Map<String, String> details() {
        return Map.of("maxFileSizeBytes", Long.toString(maxFileSizeBytes));
    }
}

class AttachmentNotFoundException extends RuntimeException {
    private final int resourceId;
    private final int attachmentId;

    AttachmentNotFoundException(int resourceId, int attachmentId) {
        super("The requested PDF attachment was not found.");
        this.resourceId = resourceId;
        this.attachmentId = attachmentId;
    }

    Map<String, String> details() {
        return Map.of("resourceId", Integer.toString(resourceId), "attachmentId", Integer.toString(attachmentId));
    }
}

class AttachmentFileMissingException extends RuntimeException {
    AttachmentFileMissingException() {
        super("The PDF file is no longer available in local storage.");
    }
}

class AttachmentStorageException extends RuntimeException {
    AttachmentStorageException(String message) {
        super(message);
    }

    AttachmentStorageException(String message, Throwable cause) {
        super(message, cause);
    }
}

class AttachmentIdempotencyConflictException extends RuntimeException {
    AttachmentIdempotencyConflictException() {
        super("This upload retry token was already used for a different PDF or resource.");
    }
}
