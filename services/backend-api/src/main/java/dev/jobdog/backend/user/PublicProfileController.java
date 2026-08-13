package dev.jobdog.backend.user;

import dev.jobdog.backend.auth.AuthenticatedUser;
import dev.jobdog.backend.auth.CurrentUser;
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
    private final CurrentUser currentUser;

    public PublicProfileController(UserRepository userRepository,
                                   ResumeAnalysisRepository analysisRepository,
                                   CurrentUser currentUser) {
        this.userRepository = userRepository;
        this.analysisRepository = analysisRepository;
        this.currentUser = currentUser;
    }

    @GetMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> getPublicProfile(@PathVariable UUID userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("userId", user.getId());
        profile.put("displayName", user.getDisplayName());

        // "PRIVATE"/"FRIENDS" both hide the score from everyone but the owner — there's
        // no connections graph backing "FRIENDS" yet, so treat it the same as private
        // rather than silently exposing scores to the whole internet.
        boolean isOwner = currentUser.get().map(AuthenticatedUser::userId).map(userId::equals).orElse(false);
        boolean scoreVisible = isOwner || "PUBLIC".equals(user.getProfileVisibility());

        if (scoreVisible) {
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
        }

        return ResponseEntity.ok(profile);
    }
}
