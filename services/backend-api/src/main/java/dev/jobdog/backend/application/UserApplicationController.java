package dev.jobdog.backend.application;

import dev.jobdog.backend.auth.CurrentUser;
import dev.jobdog.backend.benchmark.ApplicationScoreEntity;
import dev.jobdog.backend.benchmark.ApplicationScoreRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/applications")
public class UserApplicationController {

    private final ApplicationRepository applicationRepository;
    private final ApplicationScoreRepository applicationScoreRepository;
    private final CurrentUser currentUser;

    public UserApplicationController(ApplicationRepository applicationRepository,
                                     ApplicationScoreRepository applicationScoreRepository,
                                     CurrentUser currentUser) {
        this.applicationRepository = applicationRepository;
        this.applicationScoreRepository = applicationScoreRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> listApplications() {
        var userId = currentUser.require().userId();
        List<ApplicationEntity> apps = applicationRepository.findByUser_IdOrderByAppliedAtDesc(userId);

        List<Map<String, Object>> items = apps.stream().map(app -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("applicationId", app.getId());
            m.put("jobId", app.getJob().getId());
            m.put("jobTitle", app.getJob().getTitle());
            m.put("company", app.getJob().getCompany());
            m.put("status", app.getStatus().name());
            m.put("appliedAt", app.getAppliedAt());

            applicationScoreRepository.findByApplication_Id(app.getId()).ifPresent(score -> {
                m.put("matchScore", score.getMatchScore());
                m.put("percentile", score.getPercentile());
                m.put("applicantCount", score.getApplicantCount());
                m.put("benchmarkState", score.getBenchmarkState().name());
            });

            return m;
        }).toList();

        return ResponseEntity.ok(Map.of("items", items));
    }
}
