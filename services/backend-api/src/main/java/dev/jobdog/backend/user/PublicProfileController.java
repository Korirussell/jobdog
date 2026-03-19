package dev.jobdog.backend.user;

import dev.jobdog.backend.resume.ResumeAnalysisEntity;
import dev.jobdog.backend.resume.ResumeAnalysisRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/public/profile")
public class PublicProfileController {

    private final UserRepository userRepository;
    private final ResumeAnalysisRepository analysisRepository;

    public PublicProfileController(UserRepository userRepository,
                                   ResumeAnalysisRepository analysisRepository) {
        this.userRepository = userRepository;
        this.analysisRepository = analysisRepository;
    }

    @GetMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> getPublicProfile(@PathVariable UUID userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("userId", user.getId());
        profile.put("displayName", user.getDisplayName());

        // Best analysis
        analysisRepository.findTopByUserIdOrderByScoreDesc(userId).ifPresent(analysis -> {
            Map<String, Object> score = new LinkedHashMap<>();
            score.put("overallScore", analysis.getOverallScore());
            score.put("atsScore", analysis.getAtsScore());
            score.put("sectionScores", analysis.getSectionScores());
            score.put("strengths", analysis.getStrengths());
            score.put("summaryVerdict", analysis.getSummaryVerdict());
            score.put("userLevel", analysis.getUserLevel());
            score.put("targetRole", analysis.getTargetRole());
            score.put("analyzedAt", analysis.getAnalyzedAt());
            profile.put("topScore", score);
        });

        return ResponseEntity.ok(profile);
    }
}
