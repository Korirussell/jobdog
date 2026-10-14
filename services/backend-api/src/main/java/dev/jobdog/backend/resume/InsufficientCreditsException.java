package dev.jobdog.backend.resume;

/** The user has no resume uploads left. Mapped to 402 by GlobalExceptionHandler. */
public class InsufficientCreditsException extends RuntimeException {

    public InsufficientCreditsException(String message) {
        super(message);
    }
}
