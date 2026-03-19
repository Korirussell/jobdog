package dev.jobdog.backend.common.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception,
                                                             HttpServletRequest request) {
        return buildResponse(HttpStatus.BAD_REQUEST, "Validation failed", request.getRequestURI());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraintViolation(ConstraintViolationException exception,
                                                                      HttpServletRequest request) {
        return buildResponse(HttpStatus.BAD_REQUEST, exception.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgument(IllegalArgumentException exception,
                                                                  HttpServletRequest request) {
        return buildResponse(HttpStatus.BAD_REQUEST, exception.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception exception,
                                                             HttpServletRequest request) {
        // Log the full stack trace so it appears in docker logs
        LOGGER.error("Unhandled exception for path {}: {} — {}",
                request.getRequestURI(),
                exception.getClass().getSimpleName(),
                exception.getMessage(),
                exception);

        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR,
                "Server error",
                request.getRequestURI());
    }

    private ResponseEntity<ApiErrorResponse> buildResponse(HttpStatus status, String message, String path) {
        return ResponseEntity.status(status).body(new ApiErrorResponse(
                Instant.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                path
        ));
    }
}
