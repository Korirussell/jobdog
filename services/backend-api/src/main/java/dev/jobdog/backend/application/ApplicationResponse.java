package dev.jobdog.backend.application;

import dev.jobdog.backend.benchmark.BenchmarkState;

import java.util.Map;
import java.util.UUID;

public record ApplicationResponse(
        UUID applicationId,
        Integer matchScore,
        Map<String, Object> matchBreakdown,
        BenchmarkState benchmarkState,
        String message,
        Integer percentile,
        Integer applicantCount
) {
}
