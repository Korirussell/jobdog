package dev.jobdog.backend.resume;

public class ResumeInUseException extends RuntimeException {
    public ResumeInUseException(String message) {
        super(message);
    }
}
