package dev.jobdog.backend.system;

import java.time.Instant;

public record SystemHealthResponse(
        String service,
        String status,
        Instant timestamp
) {
}
