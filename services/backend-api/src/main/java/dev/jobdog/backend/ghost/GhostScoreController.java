package dev.jobdog.backend.ghost;

import dev.jobdog.backend.auth.CurrentUser;
import dev.jobdog.backend.job.JobEntity;
import dev.jobdog.backend.job.JobRepository;
import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ghost-score")
public class GhostScoreController {

    private final GhostReportRepository ghostReportRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    public GhostScoreController(GhostReportRepository ghostReportRepository,
                                JobRepository jobRepository,
                                UserRepository userRepository,
                                CurrentUser currentUser) {
        this.ghostReportRepository = ghostReportRepository;
        this.jobRepository = jobRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getGhostScore(@RequestParam String company) {
        long ghostReports = ghostReportRepository.countByCompanyIgnoreCase(company);
        List<JobEntity> companyJobs = jobRepository.findByCompanyIgnoreCase(company);

        long totalJobs = companyJobs.size();
        double avgDaysOpen = companyJobs.stream()
                .filter(j -> j.getPostedAt() != null)
                .mapToLong(j -> Duration.between(j.getPostedAt(), Instant.now()).toDays())
                .average()
                .orElse(0.0);

        // Ghost score: weighted formula based on avg days open + ghost report ratio
        int ghostScore = computeGhostScore(avgDaysOpen, ghostReports, totalJobs);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("company", company);
        result.put("ghostScore", ghostScore);
        result.put("avgDaysOpen", Math.round(avgDaysOpen));
        result.put("ghostReports", ghostReports);
        result.put("totalJobs", totalJobs);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/report")
    @Transactional
    public ResponseEntity<Map<String, String>> reportGhost(@RequestBody Map<String, String> body) {
        var userId = currentUser.require().userId();
        String company = body.get("company");
        String jobIdStr = body.get("jobId");

        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        GhostReportEntity report = new GhostReportEntity();
        report.setUser(user);
        report.setCompany(company);
        report.setReportedAt(Instant.now());

        if (jobIdStr != null) {
            JobEntity job = jobRepository.findById(UUID.fromString(jobIdStr))
                    .orElseThrow(() -> new IllegalArgumentException("Job not found"));
            report.setJob(job);
        }

        ghostReportRepository.save(report);
        return ResponseEntity.ok(Map.of("status", "reported"));
    }

    private int computeGhostScore(double avgDaysOpen, long ghostReports, long totalJobs) {
        if (totalJobs == 0) return 0;

        // Days component: jobs open > 60 days are suspicious, > 120 days very suspicious
        double daysComponent = Math.min(1.0, avgDaysOpen / 120.0) * 50;

        // Ghost report ratio component
        double reportRatio = (double) ghostReports / Math.max(1, totalJobs);
        double reportComponent = Math.min(1.0, reportRatio) * 50;

        return (int) Math.round(Math.min(100, daysComponent + reportComponent));
    }
}
