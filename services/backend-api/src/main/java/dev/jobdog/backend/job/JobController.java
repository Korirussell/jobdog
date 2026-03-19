package dev.jobdog.backend.job;

import dev.jobdog.backend.auth.CurrentUser;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/jobs")
public class JobController {

    private final JobService jobService;
    private final CurrentUser currentUser;

    public JobController(JobService jobService, CurrentUser currentUser) {
        this.jobService = jobService;
        this.currentUser = currentUser;
    }

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

    @GetMapping("/{jobId}")
    public ResponseEntity<JobDetailResponse> getJob(@PathVariable UUID jobId) {
        return ResponseEntity.ok(jobService.getActiveJob(jobId));
    }
}
