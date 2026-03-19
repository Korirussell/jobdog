package dev.jobdog.backend.job;

import java.time.Instant;
import java.util.UUID;

public record JobSummaryResponse(
        UUID jobId,
        String title,
        String company,
        String location,
        String employmentType,
        Instant postedAt,
        Instant scrapedAt,
        String jobStatus,
        String applyUrl,
        Integer matchPercentage
) {
}
