package dev.jobdog.backend.user;

import dev.jobdog.backend.resume.ResumeAnalysisRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * The page behind a shared link. No login is needed to view it: handing someone the link
 * (the Share button) is the opt-in. The id in the URL is an unguessable UUID, and only a
 * name, the best resume score and its summary are exposed, never the email or the resume.
 */
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
        String shareName = user.getShareName();
        profile.put("displayName", shareName != null && !shareName.isBlank() ? shareName : user.getDisplayName());

        analysisRepository.findTopByResume_User_IdOrderByOverallScoreDescAnalyzedAtDesc(userId).ifPresent(analysis -> {
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
