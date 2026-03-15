package dev.jobdog.backend.application;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateApplicationRequest(
        @NotNull UUID resumeId
) {
}
