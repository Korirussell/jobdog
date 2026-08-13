package dev.jobdog.backend.auth;

import jakarta.validation.constraints.Pattern;

public record UpdateProfileRequest(
        @Pattern(regexp = "PRIVATE|FRIENDS|PUBLIC") String profileVisibility
) {
}
