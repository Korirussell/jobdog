package dev.jobdog.backend.job;

import dev.jobdog.backend.ghost.GhostScoreService;
import dev.jobdog.backend.matching.LocalMatchingService;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service layer for job listing and retrieval operations.
 * Implements business logic for job filtering, pagination, and personalized matching.
 * Demonstrates Service Layer pattern and Dependency Injection.
 */
@Service
public class JobService {

    private final JobRepository jobRepository;
    private final LocalMatchingService localMatchingService;
    private final GhostScoreService ghostScoreService;

    /**
     * Constructor injection of dependencies (IoC principle).
     * @param jobRepository Data access layer for job entities
     * @param localMatchingService Deterministic matching algorithm for user-job fit
     * @param ghostScoreService Batched Ghost Score lookup for job-card metadata
     */
    public JobService(JobRepository jobRepository, LocalMatchingService localMatchingService,
                       GhostScoreService ghostScoreService) {
        this.jobRepository = jobRepository;
        this.localMatchingService = localMatchingService;
        this.ghostScoreService = ghostScoreService;
    }

    /**
     * Retrieves paginated job listings with optional filtering.
     * For authenticated users, calculates match percentage based on resume profile.
     * Uses read-only transaction for performance optimization.
     * 
     * @param filter Pagination and filter criteria
     * @param userId Optional user ID for personalized matching (null for anonymous)
     * @return Paginated job list with match scores and metadata
     */
    @Transactional(readOnly = true)
    public JobListResponse listActiveJobs(JobFilterRequest filter, UUID userId) {
        // Pageable without sort — ordering is handled by COALESCE in the JPQL queries
        Pageable pageable = PageRequest.of(filter.page(), filter.size());

        Page<JobEntity> jobPage;

        if (hasFilters(filter)) {
            boolean companyTierActive = filter.companyTier() != null;
            Set<String> companyTierCompanies = companyTierActive
                    ? CompanyTier.companiesForTier(filter.companyTier())
                    // Hibernate needs a non-empty collection to bind an IN clause; the
                    // filter is inactive here so its contents are never evaluated.
                    : Set.of("__none__");

            boolean entryTypesActive = filter.entryTypes() != null && !filter.entryTypes().isEmpty();
            List<String> entryTypes = entryTypesActive ? filter.entryTypes() : List.of("__none__");

            jobPage = jobRepository.findByFilters(
                    JobStatus.ACTIVE,
                    filter.location(),
                    filter.remote(),
                    filter.company(),
                    filter.search(),
                    entryTypesActive,
                    entryTypes,
                    filter.gradYear(),
                    companyTierActive,
                    companyTierCompanies,
                    filter.hasSalary(),
                    pageable
            );
        } else {
            jobPage = jobRepository.findByStatusOrderByEffectiveDateDesc(JobStatus.ACTIVE, pageable);
        }

        // Batch-compute Ghost Scores for every distinct company on this page in one pass,
        // instead of issuing a per-company lookup for each job.
        Set<String> pageCompanies = jobPage.getContent().stream()
                .map(JobEntity::getCompany)
                .filter(company -> company != null && !company.isBlank())
                .collect(Collectors.toSet());
        Map<String, Double> ghostScoresByCompany = ghostScoreService.computeGhostScores(pageCompanies);

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

                    String companyTier = CompanyTier.lookup(job.getCompany());
                    Double ghostScore = job.getCompany() == null
                            ? null
                            : ghostScoresByCompany.get(job.getCompany().trim().toLowerCase());

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
                            matchPercentage,
                            companyTier,
                            ghostScore,
                            job.getExperienceLevel(),
                            job.getEntryType(),
                            job.getGradYearMin() == null ? null : job.getGradYearMin().intValue(),
                            job.getGradYearMax() == null ? null : job.getGradYearMax().intValue(),
                            job.getSalaryRaw()
                    );
                })
                .toList();

        Instant lastSync = jobRepository.findLatestEffectiveDateForActiveJobs();

        return new JobListResponse(items, filter.page(), filter.size(), jobPage.getTotalElements(), lastSync);
    }

    /**
     * Retrieves full details for a specific active job.
     * 
     * @param jobId Unique identifier for the job
     * @return Complete job details including full description
     * @throws ResponseStatusException 404 if job not found or inactive
     */
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
                job.getDescriptionText(),
                CompanyTier.lookup(job.getCompany()),
                job.getExperienceLevel(),
                job.getEntryType(),
                job.getGradYearMin() == null ? null : job.getGradYearMin().intValue(),
                job.getGradYearMax() == null ? null : job.getGradYearMax().intValue(),
                job.getGradEvidence(),
                job.getSalaryRaw()
        );
    }

    private boolean hasFilters(JobFilterRequest filter) {
        return filter.location() != null ||
               filter.remote() != null ||
               filter.company() != null ||
               filter.search() != null ||
               (filter.entryTypes() != null && !filter.entryTypes().isEmpty()) ||
               filter.gradYear() != null ||
               filter.companyTier() != null ||
               Boolean.TRUE.equals(filter.hasSalary());
    }
}
