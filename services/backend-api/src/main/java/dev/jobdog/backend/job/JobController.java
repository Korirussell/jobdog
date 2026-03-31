package dev.jobdog.backend.job;

import dev.jobdog.backend.auth.AuthenticatedUser;
import dev.jobdog.backend.auth.CurrentUser;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for job listing and retrieval operations.
 * Provides public endpoints for browsing active job postings with optional filtering.
 * Supports authenticated users by calculating personalized match scores.
 */
@RestController
@RequestMapping("/api/v1/jobs")
public class JobController {

    private final JobService jobService;
    private final CurrentUser currentUser;

    /**
     * Constructor injection of dependencies (Spring DI pattern).
     * @param jobService Business logic for job operations
     * @param currentUser Thread-scoped authentication context
     */
    public JobController(JobService jobService, CurrentUser currentUser) {
        this.jobService = jobService;
        this.currentUser = currentUser;
    }

    /**
     * Retrieves a paginated list of active job postings with optional filters.
     * For authenticated users, includes personalized match percentage based on resume profile.
     * 
     * @param page Zero-based page number (default: 0)
     * @param size Number of jobs per page (default: 100)
     * @param location Filter by location string (partial match)
     * @param remote Filter for remote positions only
     * @param company Filter by company name (partial match)
     * @param search Full-text search across title and description
     * @return Paginated job list with metadata (total count, last sync time)
     */
    @GetMapping
    public ResponseEntity<JobListResponse> listJobs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) Boolean remote,
            @RequestParam(required = false) String company,
            @RequestParam(required = false) String search
    ) {
        JobFilterRequest filter = new JobFilterRequest(page, size, location, remote, company, search);
        // Pass userId if authenticated, null otherwise for local matching
        UUID userId = currentUser.get().map(AuthenticatedUser::userId).orElse(null);
        return ResponseEntity.ok(jobService.listActiveJobs(filter, userId));
    }

    /**
     * Retrieves full details for a specific job posting.
     * Returns 404 if job does not exist or is not in ACTIVE status.
     * 
     * @param jobId Unique identifier for the job
     * @return Complete job details including full description text
     */
    @GetMapping("/{jobId}")
    public ResponseEntity<JobDetailResponse> getJob(@PathVariable UUID jobId) {
        return ResponseEntity.ok(jobService.getActiveJob(jobId));
    }
}
