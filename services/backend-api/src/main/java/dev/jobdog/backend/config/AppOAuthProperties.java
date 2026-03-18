package dev.jobdog.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.oauth")
public record AppOAuthProperties(
        String frontendBaseUrl
) {
}
