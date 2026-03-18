package dev.jobdog.backend.savedjob;

import dev.jobdog.backend.auth.CurrentUser;
import dev.jobdog.backend.job.JobEntity;
import dev.jobdog.backend.job.JobRepository;
import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/saved-jobs")
public class SavedJobController {

    private final SavedJobRepository savedJobRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    public SavedJobController(SavedJobRepository savedJobRepository,
                              JobRepository jobRepository,
                              UserRepository userRepository,
                              CurrentUser currentUser) {
        this.savedJobRepository = savedJobRepository;
        this.jobRepository = jobRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> listSavedJobs() {
        var userId = currentUser.require().userId();
        List<SavedJobEntity> saved = savedJobRepository.findByUser_IdOrderBySavedAtDesc(userId);

        List<Map<String, Object>> items = saved.stream().map(s -> {
            JobEntity job = s.getJob();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("jobId", job.getId());
            m.put("title", job.getTitle());
            m.put("company", job.getCompany());
            m.put("location", job.getLocation());
            m.put("employmentType", job.getEmploymentType());
            m.put("postedAt", job.getPostedAt());
            m.put("applyUrl", job.getSourceUrl());
            m.put("savedAt", s.getSavedAt());
            return m;
        }).toList();

        return ResponseEntity.ok(Map.of("items", items));
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Map<String, Object>> saveJob(@RequestBody Map<String, String> body) {
        var userId = currentUser.require().userId();
        UUID jobId = UUID.fromString(body.get("jobId"));

        if (savedJobRepository.findByUser_IdAndJob_Id(userId, jobId).isPresent()) {
            throw new IllegalArgumentException("Job already saved");
        }

        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        JobEntity job = jobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found"));

        SavedJobEntity entity = new SavedJobEntity();
        entity.setUser(user);
        entity.setJob(job);
        entity.setSavedAt(Instant.now());
        SavedJobEntity saved = savedJobRepository.save(entity);

        return ResponseEntity.ok(Map.of("savedJobId", saved.getId(), "jobId", jobId));
    }

    @DeleteMapping("/{jobId}")
    @Transactional
    public ResponseEntity<Void> unsaveJob(@PathVariable UUID jobId) {
        var userId = currentUser.require().userId();
        savedJobRepository.deleteByUser_IdAndJob_Id(userId, jobId);
        return ResponseEntity.noContent().build();
    }
}
