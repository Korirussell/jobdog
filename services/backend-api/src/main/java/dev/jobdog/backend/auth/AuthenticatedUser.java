package dev.jobdog.backend.auth;

import dev.jobdog.backend.user.UserRole;

import java.util.UUID;

public record AuthenticatedUser(
        UUID userId,
        String email,
        UserRole role
) {
}
