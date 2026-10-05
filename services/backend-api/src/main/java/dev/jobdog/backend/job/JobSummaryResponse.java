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
        // When JobDog first saw the posting. For rows with no posted date (aggregator
        // lists publish none), this is the honest "added" date; scrapedAt is bumped
        // every cycle and would make every old listing look new.
        Instant addedAt,
        String jobStatus,
        String applyUrl,
        Integer matchPercentage,
        String companyTier,
        String experienceLevel,
        String entryType,
        Integer gradYearMin,
        Integer gradYearMax,
        String salaryRaw
) {
}
