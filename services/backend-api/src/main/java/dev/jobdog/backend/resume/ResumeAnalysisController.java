package dev.jobdog.backend.resume;

import dev.jobdog.backend.auth.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/resume-analysis")
public class ResumeAnalysisController {

    private final ResumeAnalysisService analysisService;
    private final CurrentUser currentUser;

    public ResumeAnalysisController(ResumeAnalysisService analysisService, CurrentUser currentUser) {
        this.analysisService = analysisService;
        this.currentUser = currentUser;
    }

    /** Returns the latest cached analysis for a resume, or 204 if none exists yet. */
    @GetMapping("/{resumeId}")
    public ResponseEntity<Map<String, Object>> getAnalysis(@PathVariable UUID resumeId) {
        ResumeAnalysisEntity entity = analysisService.getLatestAnalysis(
                currentUser.require().userId(), resumeId);
        if (entity == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(toAnalysisMap(entity));
    }

    /** Triggers a fresh deep analysis. */
    @PostMapping
    public ResponseEntity<Map<String, Object>> analyze(@RequestBody AnalyzeRequest req) {
        ResumeAnalysisEntity entity = analysisService.analyze(
                currentUser.require().userId(),
                req.resumeId(),
                req.userLevel(),
                req.targetRole()
        );
        return ResponseEntity.ok(toAnalysisMap(entity));
    }

    /** Returns job fit score for a resume against a specific job. */
    @PostMapping("/job-fit")
    public ResponseEntity<Map<String, Object>> jobFit(@RequestBody JobFitRequest req) {
        ResumeJobFitEntity entity = analysisService.getJobFit(
                currentUser.require().userId(),
                req.resumeId(),
                req.jobId()
        );
        return ResponseEntity.ok(toJobFitMap(entity));
    }

    private Map<String, Object> toAnalysisMap(ResumeAnalysisEntity e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("analysisId", e.getId());
        m.put("resumeId", e.getResume().getId());
        m.put("userLevel", e.getUserLevel());
        m.put("targetRole", e.getTargetRole());
        m.put("overallScore", e.getOverallScore());
        m.put("atsScore", e.getAtsScore());
        m.put("atsIssues", e.getAtsIssues());
        m.put("sectionScores", e.getSectionScores());
        m.put("bulletFeedback", e.getBulletFeedback());
        m.put("strengths", e.getStrengths());
        m.put("improvements", e.getImprovements());
        m.put("summaryVerdict", e.getSummaryVerdict());
        m.put("analyzedAt", e.getAnalyzedAt());
        return m;
    }

    private Map<String, Object> toJobFitMap(ResumeJobFitEntity e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("fitId", e.getId());
        m.put("resumeId", e.getResume().getId());
        m.put("jobId", e.getJob().getId());
        m.put("jobTitle", e.getJob().getTitle());
        m.put("company", e.getJob().getCompany());
        m.put("fitScore", e.getFitScore());
        m.put("matchedSkills", e.getMatchedSkills());
        m.put("missingSkills", e.getMissingSkills());
        m.put("fitSummary", e.getFitSummary());
        m.put("analyzedAt", e.getAnalyzedAt());
        return m;
    }

    record AnalyzeRequest(UUID resumeId, String userLevel, String targetRole) {}
    record JobFitRequest(UUID resumeId, UUID jobId) {}
}
