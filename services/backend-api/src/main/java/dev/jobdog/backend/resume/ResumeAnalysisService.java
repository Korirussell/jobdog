package dev.jobdog.backend.resume;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.theokanning.openai.completion.chat.ChatCompletionRequest;
import com.theokanning.openai.completion.chat.ChatMessage;
import com.theokanning.openai.service.OpenAiService;
import dev.jobdog.backend.job.JobEntity;
import dev.jobdog.backend.job.JobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ResumeAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(ResumeAnalysisService.class);

    private final ResumeRepository resumeRepository;
    private final ResumeAnalysisRepository analysisRepository;
    private final ResumeJobFitRepository jobFitRepository;
    private final JobRepository jobRepository;
    private final OpenAiService openAiService;
    private final StorageService storageService;
    private final PdfTextExtractor pdfTextExtractor;
    private final ObjectMapper objectMapper;

    public ResumeAnalysisService(ResumeRepository resumeRepository,
                                 ResumeAnalysisRepository analysisRepository,
                                 ResumeJobFitRepository jobFitRepository,
                                 JobRepository jobRepository,
                                 OpenAiService openAiService,
                                 StorageService storageService,
                                 PdfTextExtractor pdfTextExtractor,
                                 ObjectMapper objectMapper) {
        this.resumeRepository = resumeRepository;
        this.analysisRepository = analysisRepository;
        this.jobFitRepository = jobFitRepository;
        this.jobRepository = jobRepository;
        this.openAiService = openAiService;
        this.storageService = storageService;
        this.pdfTextExtractor = pdfTextExtractor;
        this.objectMapper = objectMapper;
    }

    /**
     * Returns the most recent cached analysis for a resume, or null if none exists.
     */
    @Transactional(readOnly = true)
    public ResumeAnalysisEntity getLatestAnalysis(UUID userId, UUID resumeId) {
        ResumeEntity resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new IllegalArgumentException("Resume not found"));
        if (!resume.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Resume does not belong to user");
        }
        return analysisRepository.findTopByResume_IdOrderByAnalyzedAtDesc(resumeId).orElse(null);
    }

    /**
     * Runs a full deep analysis and persists the result. Re-runs even if a cached result exists
     * (user explicitly requested a fresh analysis with potentially new role/level).
     */
    @Transactional
    public ResumeAnalysisEntity analyze(UUID userId, UUID resumeId, String userLevel, String targetRole) {
        ResumeEntity resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new IllegalArgumentException("Resume not found"));
        if (!resume.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Resume does not belong to user");
        }
        if (resume.getStatus() != ResumeStatus.PARSED) {
            throw new IllegalArgumentException("Resume must be fully parsed before analysis. Current status: " + resume.getStatus());
        }

        String resolvedLevel = (userLevel == null || userLevel.isBlank()) ? "INTERN" : userLevel.toUpperCase();
        String resolvedRole = (targetRole == null || targetRole.isBlank()) ? "Software Engineer" : targetRole.trim();

        byte[] pdfBytes = fetchResumeBytes(resume);
        String resumeText = pdfTextExtractor.extractText(pdfBytes);
        String truncated = resumeText.substring(0, Math.min(resumeText.length(), 4000));

        String aiResponse = callOpenAi(buildAnalysisPrompt(truncated, resolvedLevel, resolvedRole), 3000);
        return parseAndSaveAnalysis(resume, resolvedLevel, resolvedRole, aiResponse);
    }

    /**
     * Scores a resume against a specific job. Returns cached result if already computed.
     */
    @Transactional
    public ResumeJobFitEntity getJobFit(UUID userId, UUID resumeId, UUID jobId) {
        ResumeEntity resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new IllegalArgumentException("Resume not found"));
        if (!resume.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Resume does not belong to user");
        }
        JobEntity job = jobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found"));

        // Return cached result if it exists
        return jobFitRepository.findByResume_IdAndJob_Id(resumeId, jobId)
                .orElseGet(() -> computeJobFit(resume, job));
    }

    private ResumeJobFitEntity computeJobFit(ResumeEntity resume, JobEntity job) {
        byte[] pdfBytes = fetchResumeBytes(resume);
        String resumeText = pdfTextExtractor.extractText(pdfBytes);
        String truncatedResume = resumeText.substring(0, Math.min(resumeText.length(), 3500));
        String truncatedJob = job.getDescriptionText() == null ? ""
                : job.getDescriptionText().substring(0, Math.min(job.getDescriptionText().length(), 2000));

        String aiResponse = callOpenAi(buildJobFitPrompt(truncatedResume, truncatedJob, job.getTitle(), job.getCompany()), 1200);
        return parseAndSaveJobFit(resume, job, aiResponse);
    }

    private byte[] fetchResumeBytes(ResumeEntity resume) {
        String key = resume.getStorageKey();
        if (key.startsWith("local-fallback/")) {
            throw new IllegalStateException("Resume was not uploaded to storage — please re-upload your resume to enable analysis.");
        }
        return storageService.getObject(key);
    }

    private String callOpenAi(String prompt, int maxTokens) {
        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("gpt-4o-mini")
                .messages(List.of(
                        new ChatMessage("system", ANALYSIS_SYSTEM_PROMPT),
                        new ChatMessage("user", prompt)
                ))
                .temperature(0.3)
                .maxTokens(maxTokens)
                .build();

        return openAiService.createChatCompletion(request)
                .getChoices()
                .get(0)
                .getMessage()
                .getContent();
    }

    private ResumeAnalysisEntity parseAndSaveAnalysis(ResumeEntity resume, String userLevel,
                                                       String targetRole, String aiResponse) {
        try {
            // Strip markdown code fences if present
            String json = stripCodeFences(aiResponse);
            JsonNode root = objectMapper.readTree(json);

            ResumeAnalysisEntity entity = new ResumeAnalysisEntity();
            entity.setResume(resume);
            entity.setUserLevel(userLevel);
            entity.setTargetRole(targetRole);
            entity.setOverallScore(clamp(root.path("overall_score").asInt(50)));
            entity.setAtsScore(clamp(root.path("ats_score").asInt(50)));
            entity.setAtsIssues(readStringList(root, "ats_issues"));

            Map<String, Integer> sectionScores = new LinkedHashMap<>();
            JsonNode ss = root.path("section_scores");
            if (ss.isObject()) {
                ss.fields().forEachRemaining(e -> sectionScores.put(e.getKey(), clamp(e.getValue().asInt(50))));
            }
            entity.setSectionScores(sectionScores);

            List<Map<String, Object>> bulletFeedback = new ArrayList<>();
            JsonNode bf = root.path("bullet_feedback");
            if (bf.isArray()) {
                bf.forEach(item -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("original", item.path("original").asText(""));
                    m.put("score", clamp(item.path("score").asInt(50)));
                    m.put("issue", item.path("issue").asText(""));
                    m.put("improved", item.path("improved").asText(""));
                    bulletFeedback.add(m);
                });
            }
            entity.setBulletFeedback(bulletFeedback);

            entity.setStrengths(readStringList(root, "strengths"));
            entity.setImprovements(readStringList(root, "improvements"));
            entity.setSummaryVerdict(root.path("summary_verdict").asText("Analysis complete."));
            entity.setAnalyzedAt(Instant.now());

            return analysisRepository.save(entity);
        } catch (Exception e) {
            log.error("Failed to parse analysis response: {}", aiResponse, e);
            throw new RuntimeException("Failed to parse AI analysis response. Please try again.", e);
        }
    }

    private ResumeJobFitEntity parseAndSaveJobFit(ResumeEntity resume, JobEntity job, String aiResponse) {
        try {
            String json = stripCodeFences(aiResponse);
            JsonNode root = objectMapper.readTree(json);

            ResumeJobFitEntity entity = new ResumeJobFitEntity();
            entity.setResume(resume);
            entity.setJob(job);
            entity.setFitScore(clamp(root.path("fit_score").asInt(50)));
            entity.setMatchedSkills(readStringList(root, "matched_skills"));
            entity.setMissingSkills(readStringList(root, "missing_skills"));
            entity.setFitSummary(root.path("fit_summary").asText("Analysis complete."));
            entity.setAnalyzedAt(Instant.now());

            return jobFitRepository.save(entity);
        } catch (Exception e) {
            log.error("Failed to parse job fit response: {}", aiResponse, e);
            throw new RuntimeException("Failed to parse AI job fit response. Please try again.", e);
        }
    }

    private List<String> readStringList(JsonNode root, String field) {
        JsonNode node = root.path(field);
        if (!node.isArray()) return Collections.emptyList();
        List<String> result = new ArrayList<>();
        node.forEach(n -> result.add(n.asText()));
        return result;
    }

    private String stripCodeFences(String text) {
        if (text == null) return "{}";
        String trimmed = text.trim();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline >= 0) trimmed = trimmed.substring(firstNewline + 1);
            if (trimmed.endsWith("```")) trimmed = trimmed.substring(0, trimmed.length() - 3);
        }
        return trimmed.trim();
    }

    private static int clamp(int value) {
        return Math.max(0, Math.min(100, value));
    }

    // ── Prompts ──────────────────────────────────────────────────────────────

    private static String buildAnalysisPrompt(String resumeText, String userLevel, String targetRole) {
        String levelLabel = "INTERN".equals(userLevel) ? "internship" : "new grad / entry-level full-time";
        return String.format("""
                CANDIDATE LEVEL: %s (%s)
                TARGET ROLE: %s
                
                RESUME:
                %s
                
                Analyze this resume as a senior technical recruiter at a top tech company (Google, Meta, Apple, Amazon, Microsoft level).
                Grade it specifically for a %s %s position.
                
                Return ONLY valid JSON — no markdown, no explanation, just the JSON object:
                {
                  "overall_score": <0-100, honest overall grade for this level and role>,
                  "ats_score": <0-100, how well this resume will pass ATS keyword scanning>,
                  "ats_issues": [
                    "<specific ATS issue, e.g. 'Missing keywords: React, TypeScript, REST APIs'>",
                    "<another issue>"
                  ],
                  "section_scores": {
                    "experience": <0-100>,
                    "skills": <0-100>,
                    "education": <0-100>,
                    "formatting": <0-100>,
                    "impact_language": <0-100>
                  },
                  "bullet_feedback": [
                    {
                      "original": "<exact bullet point text from resume>",
                      "score": <0-100>,
                      "issue": "<what's wrong with this bullet>",
                      "improved": "<rewritten version with stronger impact language and metrics>"
                    }
                  ],
                  "strengths": [
                    "<specific strength, e.g. 'Strong GPA from a target school'>",
                    "<another strength>"
                  ],
                  "improvements": [
                    "<specific actionable improvement, e.g. 'Add quantified metrics to all experience bullets'>",
                    "<another improvement>"
                  ],
                  "summary_verdict": "<2-3 sentences: honest overall assessment, what would make this resume competitive, and the single most important thing to fix>"
                }
                
                Scoring rubric:
                - 90-100: Ready to interview at FAANG for this level right now
                - 75-89: Strong candidate, minor polish needed
                - 60-74: Decent but clear gaps for top companies
                - 40-59: Needs significant work
                - 20-39: Major gaps — foundational issues
                - 0-19: Needs a complete overhaul
                
                Be brutally honest. Do not inflate scores. A typical intern resume scores 40-60.
                Include ALL experience bullets in bullet_feedback (up to 10 most important ones).
                """, userLevel, levelLabel, targetRole, resumeText, levelLabel, targetRole);
    }

    private static String buildJobFitPrompt(String resumeText, String jobDescription,
                                             String jobTitle, String company) {
        return String.format("""
                TARGET JOB: %s at %s
                
                JOB DESCRIPTION:
                %s
                
                CANDIDATE RESUME:
                %s
                
                Score how well this resume matches this specific job. Return ONLY valid JSON:
                {
                  "fit_score": <0-100, how well the resume matches this specific job>,
                  "matched_skills": [
                    "<skill or requirement from the job that the resume demonstrates>"
                  ],
                  "missing_skills": [
                    "<skill or requirement from the job that is absent from the resume>"
                  ],
                  "fit_summary": "<2-3 sentences: would this resume get an interview for this role, what are the biggest gaps, and what would make it competitive>"
                }
                
                Be specific. Reference actual requirements from the job description.
                """, jobTitle, company, jobDescription, resumeText);
    }

    private static final String ANALYSIS_SYSTEM_PROMPT = """
            You are a senior technical recruiter at a FAANG-level company with 10+ years of experience \
            reviewing intern and new grad resumes. You have seen thousands of resumes and know exactly \
            what gets candidates interviews at top tech companies. \
            You give honest, specific, actionable feedback — not generic advice. \
            You reference specific details from the resume. You do not inflate scores. \
            You always respond with valid JSON only — no markdown formatting, no preamble.""";
}
