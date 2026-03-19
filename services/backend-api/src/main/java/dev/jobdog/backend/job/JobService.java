package dev.jobdog.backend.job;

import dev.jobdog.backend.matching.LocalMatchingService;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class JobService {

    private final JobRepository jobRepository;
    private final LocalMatchingService localMatchingService;

    public JobService(JobRepository jobRepository, LocalMatchingService localMatchingService) {
        this.jobRepository = jobRepository;
        this.localMatchingService = localMatchingService;
    }

    @Transactional(readOnly = true)
    public JobListResponse listActiveJobs(JobFilterRequest filter, UUID userId) {
        // Pageable without sort — ordering is handled by COALESCE in the JPQL queries
        Pageable pageable = PageRequest.of(filter.page(), filter.size());

        Page<JobEntity> jobPage;

        if (hasFilters(filter)) {
            jobPage = jobRepository.findByFilters(
                    JobStatus.ACTIVE,
                    filter.location(),
                    filter.remote(),
                    filter.company(),
                    filter.search(),
                    pageable
            );
        } else {
            jobPage = jobRepository.findByStatusOrderByEffectiveDateDesc(JobStatus.ACTIVE, pageable);
        }

        List<JobSummaryResponse> items = jobPage.getContent()
                .stream()
                .map(job -> {
                    // Calculate local match percentage if user is authenticated
                    Integer matchPercentage = null;
                    if (userId != null) {
                        try {
                            matchPercentage = localMatchingService.calculateUserJobMatch(
                                userId, 
                                job.getDescriptionText()
                            );
                        } catch (Exception e) {
                            // If matching fails, just return null - don't break the feed
                        }
                    }
                    
                    return new JobSummaryResponse(
                            job.getId(),
                            job.getTitle(),
                            job.getCompany(),
                            job.getLocation(),
                            job.getEmploymentType(),
                            job.getPostedAt(),
                            job.getScrapedAt(),
                            job.getStatus().name(),
                            job.getSourceUrl(),
                            matchPercentage
                    );
                })
                .toList();

        Instant lastSync = jobRepository.findLatestEffectiveDateForActiveJobs();

        return new JobListResponse(items, filter.page(), filter.size(), jobPage.getTotalElements(), lastSync);
    }

    @Transactional(readOnly = true)
    public JobDetailResponse getActiveJob(UUID jobId) {
        JobEntity job = jobRepository.findByIdAndStatus(jobId, JobStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));

        return new JobDetailResponse(
                job.getId(),
                job.getTitle(),
                job.getCompany(),
                job.getLocation(),
                job.getEmploymentType(),
                job.getPostedAt(),
                job.getScrapedAt(),
                job.getStatus().name(),
                job.getSourceUrl(),
                job.getDescriptionText()
        );
    }

    private boolean hasFilters(JobFilterRequest filter) {
        return filter.location() != null ||
               filter.remote() != null ||
               filter.company() != null ||
               filter.search() != null;
    }
}
