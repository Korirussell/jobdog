package dev.jobdog.backend.auth;

import java.time.Instant;
import java.util.UUID;

public record AuthResponse(
        UUID userId,
        String email,
        String displayName,
        String token,
        Instant expiresAt
) {
}
