package dev.jobdog.backend.job;

import java.time.Instant;
import java.util.UUID;

public record JobDTO(
    UUID jobId,
    String title,
    String company,
    String location,
    String employmentType,
    Instant postedAt,
    String applyUrl
) {
    public static JobDTO from(JobEntity entity) {
        return new JobDTO(
            entity.getId(),
            entity.getTitle(),
            entity.getCompany(),
            entity.getLocation(),
            entity.getEmploymentType(),
            entity.getPostedAt(),
            entity.getSourceUrl()
        );
    }
}
