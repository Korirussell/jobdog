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
        String truncated = resumeText.substring(0, Math.min(resumeText.length(), 5000));

        String aiResponse = callOpenAi(buildAnalysisPrompt(truncated, resolvedLevel, resolvedRole), 4000);
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

            // ATS parsed sections
            JsonNode aps = root.path("ats_parsed_sections");
            if (aps.isObject()) {
                Map<String, Object> parsedSections = new LinkedHashMap<>();
                aps.fields().forEachRemaining(e -> {
                    JsonNode val = e.getValue();
                    if (val.isArray()) {
                        List<String> items = new ArrayList<>();
                        val.forEach(n -> items.add(n.asText()));
                        parsedSections.put(e.getKey(), items);
                    } else {
                        parsedSections.put(e.getKey(), val.asText(""));
                    }
                });
                entity.setAtsParsedSections(parsedSections);
            }

            // Recruiter take per section
            List<Map<String, Object>> recruiterTake = new ArrayList<>();
            JsonNode rt = root.path("recruiter_take");
            if (rt.isArray()) {
                rt.forEach(item -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("section", item.path("section").asText(""));
                    m.put("grade", item.path("grade").asText(""));
                    m.put("comment", item.path("comment").asText(""));
                    m.put("redFlags", readStringListFromNode(item, "red_flags"));
                    recruiterTake.add(m);
                });
            }
            entity.setRecruiterTake(recruiterTake);

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
        return readStringListFromNode(root, field);
    }

    private List<String> readStringListFromNode(JsonNode node, String field) {
        JsonNode arr = node.path(field);
        if (!arr.isArray()) return Collections.emptyList();
        List<String> result = new ArrayList<>();
        arr.forEach(n -> result.add(n.asText()));
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
                
                RESUME TEXT:
                %s
                
                You are a senior technical recruiter at a FAANG company reviewing this resume for a %s %s role.
                Provide a deep, honest analysis. Do NOT pad with generic advice or keyword stuffing warnings unless they are genuinely present.
                Reference specific content from the resume. Be direct and useful.
                
                Return ONLY valid JSON (no markdown, no preamble):
                {
                  "overall_score": <0-100>,
                  "ats_score": <0-100, how cleanly an ATS system can parse this resume>,
                  "ats_issues": ["<specific ATS parsing problem if any — only real issues, not generic>"],
                  "ats_parsed_sections": {
                    "name": "<candidate name as ATS would read it>",
                    "contact": "<email, phone, linkedin, github — what was found>",
                    "education": ["<each degree/school/GPA entry as a string>"],
                    "experience": ["<each job title + company + dates as a string>"],
                    "projects": ["<each project name + tech stack as a string>"],
                    "skills": ["<each skill or skill category as listed>"],
                    "certifications": ["<any certs found>"],
                    "missing_sections": ["<sections a strong resume should have but this one lacks>"]
                  },
                  "section_scores": {
                    "experience": <0-100>,
                    "projects": <0-100>,
                    "skills": <0-100>,
                    "education": <0-100>,
                    "formatting": <0-100>,
                    "impact_language": <0-100>
                  },
                  "recruiter_take": [
                    {
                      "section": "<section name, e.g. 'Experience', 'Projects', 'Skills'>",
                      "grade": "<A/B/C/D/F>",
                      "comment": "<2-3 sentence honest recruiter take on this section specifically>",
                      "red_flags": ["<specific red flag if any — leave empty array if none>"]
                    }
                  ],
                  "bullet_feedback": [
                    {
                      "original": "<exact bullet text from resume>",
                      "score": <0-100>,
                      "issue": "<specific problem: vague verb, no metric, unclear impact, etc.>",
                      "improved": "<rewritten bullet with strong action verb, metric, and clear impact>"
                    }
                  ],
                  "strengths": ["<specific strength grounded in resume content — max 4>"],
                  "improvements": ["<specific, actionable improvement — not generic — max 5>"],
                  "summary_verdict": "<3 sentences: honest overall assessment for this level/role, biggest gap, and the one thing that would most improve this resume>"
                }
                
                Scoring rubric (be honest — do not inflate):
                - 90-100: FAANG-ready for this level right now
                - 75-89: Strong, minor polish needed
                - 60-74: Decent but clear gaps
                - 40-59: Needs significant work
                - 20-39: Major foundational issues
                - 0-19: Complete overhaul needed
                
                A typical intern resume scores 40-60. Include up to 10 bullets in bullet_feedback.
                For recruiter_take, cover every major section present in the resume.
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
