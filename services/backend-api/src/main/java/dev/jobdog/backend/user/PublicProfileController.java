package dev.jobdog.backend.user;

import dev.jobdog.backend.resume.ResumeAnalysisRepository;
import dev.jobdog.backend.resume.ResumeEntity;
import dev.jobdog.backend.resume.StorageService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
 * name, the best resume score and its summary are exposed, never the email. The resume PDF
 * and ATS view are included only when the owner turns on share_resume.
 */
@RestController
@RequestMapping("/api/v1/public/profile")
public class PublicProfileController {

    private final UserRepository userRepository;
    private final ResumeAnalysisRepository analysisRepository;
    private final StorageService storageService;

    public PublicProfileController(UserRepository userRepository,
                                   ResumeAnalysisRepository analysisRepository,
                                   StorageService storageService) {
        this.userRepository = userRepository;
        this.analysisRepository = analysisRepository;
        this.storageService = storageService;
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
            if (user.isShareResume()) {
                // Same opt-in covers the ATS view, since it echoes the resume contents.
                score.put("atsParsedSections", analysis.getAtsParsedSections());
                score.put("atsIssues", analysis.getAtsIssues());
                profile.put("resumeShared", true);
            }
            profile.put("topScore", score);
        });

        return ResponseEntity.ok(profile);
    }

    /** The PDF behind the score, only when its owner opted in to sharing it. */
    @GetMapping("/{userId}/resume")
    public ResponseEntity<byte[]> getSharedResume(@PathVariable UUID userId) {
        UserEntity user = userRepository.findById(userId).orElse(null);
        if (user == null || !user.isShareResume()) {
            return ResponseEntity.notFound().build();
        }
        return analysisRepository.findTopByResume_User_IdOrderByOverallScoreDescAnalyzedAtDesc(userId)
                .map(analysis -> {
                    ResumeEntity resume = analysis.getResume();
                    byte[] bytes = storageService.getObject(resume.getStorageKey());
                    return ResponseEntity.ok()
                            .contentType(MediaType.APPLICATION_PDF)
                            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=resume.pdf")
                            .header("X-Content-Type-Options", "nosniff")
                            .body(bytes);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
