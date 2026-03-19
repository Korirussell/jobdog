package dev.jobdog.backend.job;

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

    public JobController(JobService jobService) {
        this.jobService = jobService;
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
        return ResponseEntity.ok(jobService.listActiveJobs(filter));
    }

    @GetMapping("/{jobId}")
    public ResponseEntity<JobDetailResponse> getJob(@PathVariable UUID jobId) {
        return ResponseEntity.ok(jobService.getActiveJob(jobId));
    }
}
