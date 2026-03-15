package dev.jobdog.backend.resume;

import java.time.Instant;
import java.util.UUID;

public record ResumeUploadResponse(
        UUID resumeId,
        String status,
        String storageKey,
        Instant uploadedAt
) {
}
