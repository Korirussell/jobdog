package dev.jobdog.backend.auth;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Both fields are optional: null leaves a value unchanged, and an empty shareName clears it. */
public record UpdateProfileRequest(
        @Pattern(regexp = "PRIVATE|FRIENDS|PUBLIC") String profileVisibility,
        @Size(max = 40) String shareName,
        Boolean shareResume
) {
}
