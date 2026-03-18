package dev.jobdog.backend.job;

import java.time.Instant;
import java.util.List;

public record JobListResponse(
        List<JobSummaryResponse> items,
        int page,
        int size,
        long total,
        Instant lastSync
) {
}
