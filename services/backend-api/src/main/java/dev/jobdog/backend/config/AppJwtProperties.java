package dev.jobdog.backend.config;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Validated
@ConfigurationProperties(prefix = "app.jwt")
public record AppJwtProperties(
        @NotBlank @Size(min = 32) String secret,
        @NotNull Duration expiration
) {
}
