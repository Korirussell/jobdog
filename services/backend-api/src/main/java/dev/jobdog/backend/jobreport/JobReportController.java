package dev.jobdog.backend.jobreport;

import dev.jobdog.backend.auth.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Deliberately not under /api/v1/jobs/**: that prefix is public, and these need a
 * signed-in user (credits attach to an account).
 */
@RestController
@RequestMapping("/api/v1/job-reports")
public class JobReportController {

    private final JobReportService service;
    private final CurrentUser currentUser;

    public JobReportController(JobReportService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    /** Body: {"jobId": "...", "verdict": "WORKS" | "DEAD"}. */
    @PostMapping
    public ResponseEntity<Map<String, Object>> report(@RequestBody Map<String, String> body) {
        UUID jobId = UUID.fromString(String.valueOf(body.get("jobId")));
        return ResponseEntity.ok(service.report(currentUser.require().userId(), jobId, body.get("verdict")));
    }

    /** The signed-in user's own verdicts, keyed by job id. */
    @GetMapping("/mine")
    public ResponseEntity<Map<String, String>> mine() {
        return ResponseEntity.ok(service.verdictsFor(currentUser.require().userId()));
    }
}
