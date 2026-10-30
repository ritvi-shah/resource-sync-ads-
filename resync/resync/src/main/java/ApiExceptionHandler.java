import org.springframework.dao.DataAccessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.util.unit.DataSize;

import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @Value("${app.attachment.max-file-size:20MB}")
    private DataSize maxAttachmentFileSize;

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ResourceDtos.ApiError> notFound(ResourceNotFoundException exception) {
        Map<String, String> details = new LinkedHashMap<>(exception.details());
        return response(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", exception.getMessage(), details, exception.searchMetrics());
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ResourceDtos.ApiError> duplicate(DuplicateResourceException exception) {
        return response(HttpStatus.CONFLICT, "DUPLICATE_RESOURCE_ID", exception.getMessage(),
                Map.of("resourceId", Integer.toString(exception.resourceId())), null);
    }

    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ResourceDtos.ApiError> invalid(InvalidRequestException exception) {
        return response(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", exception.getMessage(), Map.of(), null);
    }

    @ExceptionHandler(InvalidAttachmentException.class)
    public ResponseEntity<ResourceDtos.ApiError> invalidAttachment(InvalidAttachmentException exception) {
        return response(HttpStatus.BAD_REQUEST, "INVALID_ATTACHMENT", exception.getMessage(), Map.of(), null);
    }

    @ExceptionHandler(AttachmentTooLargeException.class)
    public ResponseEntity<ResourceDtos.ApiError> attachmentTooLarge(AttachmentTooLargeException exception) {
        return response(HttpStatus.PAYLOAD_TOO_LARGE, "ATTACHMENT_TOO_LARGE", exception.getMessage(), exception.details(), null);
    }

    @ExceptionHandler(AttachmentIdempotencyConflictException.class)
    public ResponseEntity<ResourceDtos.ApiError> attachmentIdempotencyConflict(AttachmentIdempotencyConflictException exception) {
        return response(HttpStatus.CONFLICT, "ATTACHMENT_IDEMPOTENCY_CONFLICT", exception.getMessage(), Map.of(), null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ResourceDtos.ApiError> multipartTooLarge(MaxUploadSizeExceededException exception) {
        return response(HttpStatus.PAYLOAD_TOO_LARGE, "ATTACHMENT_TOO_LARGE", "The upload exceeds the configured size limit.",
                Map.of("maxFileSizeBytes", Long.toString(maxAttachmentFileSize.toBytes())), null);
    }

    @ExceptionHandler(AttachmentNotFoundException.class)
    public ResponseEntity<ResourceDtos.ApiError> attachmentNotFound(AttachmentNotFoundException exception) {
        return response(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", exception.getMessage(), exception.details(), null);
    }

    @ExceptionHandler(AttachmentFileMissingException.class)
    public ResponseEntity<ResourceDtos.ApiError> attachmentFileMissing(AttachmentFileMissingException exception) {
        return response(HttpStatus.NOT_FOUND, "ATTACHMENT_FILE_MISSING", exception.getMessage(), Map.of(), null);
    }

    @ExceptionHandler(AttachmentStorageException.class)
    public ResponseEntity<ResourceDtos.ApiError> attachmentStorage(AttachmentStorageException exception) {
        return response(HttpStatus.SERVICE_UNAVAILABLE, "ATTACHMENT_STORAGE_UNAVAILABLE", "The PDF storage service could not complete the request.", Map.of(), null);
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ResourceDtos.ApiError> missingMultipartPart(MissingServletRequestPartException exception) {
        return response(HttpStatus.BAD_REQUEST, "INVALID_ATTACHMENT", "A PDF file is required in multipart field 'file'.", Map.of(), null);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ResourceDtos.ApiError> unsupportedMediaType(HttpMediaTypeNotSupportedException exception) {
        return response(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "INVALID_ATTACHMENT_MEDIA_TYPE", "Upload a PDF using multipart/form-data.", Map.of(), null);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ResourceDtos.ApiError> malformedMultipart(MultipartException exception) {
        return response(HttpStatus.BAD_REQUEST, "INVALID_MULTIPART_REQUEST", "The multipart upload could not be read.", Map.of(), null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ResourceDtos.ApiError> validation(MethodArgumentNotValidException exception) {
        Map<String, String> details = new LinkedHashMap<>();
        for (FieldError error : exception.getBindingResult().getFieldErrors()) {
            details.putIfAbsent(error.getField(), error.getDefaultMessage() == null ? "Invalid value." : error.getDefaultMessage());
        }
        return response(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Request validation failed.", details, null);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ResourceDtos.ApiError> constraintViolation(ConstraintViolationException exception) {
        return response(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Request validation failed.", Map.of(), null);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ResourceDtos.ApiError> unreadable(HttpMessageNotReadableException exception) {
        return response(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Request body is missing or malformed.", Map.of(), null);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ResourceDtos.ApiError> typeMismatch(MethodArgumentTypeMismatchException exception) {
        String parameter = exception.getName();
        return response(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Parameter '" + parameter + "' has an invalid value.",
                Map.of("parameter", parameter), null);
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ResourceDtos.ApiError> persistence(DataAccessException exception) {
        return response(HttpStatus.SERVICE_UNAVAILABLE, "PERSISTENCE_UNAVAILABLE", "The data store could not complete the request.", Map.of(), null);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ResourceDtos.ApiError> badArgument(IllegalArgumentException exception) {
        return response(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Request contains an invalid value.", Map.of(), null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ResourceDtos.ApiError> unexpected(Exception exception) {
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "The server could not complete the request.", Map.of(), null);
    }

    private ResponseEntity<ResourceDtos.ApiError> response(
            HttpStatus status,
            String code,
            String message,
            Map<String, String> details,
            ResourceDtos.SearchMetricsView searchMetrics) {
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .body(new ResourceDtos.ApiError(code, message, details, Instant.now(), searchMetrics));
    }
}
