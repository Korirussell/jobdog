package dev.jobdog.backend.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app.oauth")
public record AppOAuthProperties(
        @NotBlank String frontendBaseUrl
) {
}
