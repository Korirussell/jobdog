package dev.jobdog.backend.resume;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.theokanning.openai.completion.chat.ChatCompletionRequest;
import com.theokanning.openai.completion.chat.ChatMessage;
import com.theokanning.openai.service.OpenAiService;
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
    private final OpenAiService openAiService;
    private final StorageService storageService;
    private final PdfTextExtractor pdfTextExtractor;
    private final ObjectMapper objectMapper;

    public ResumeAnalysisService(ResumeRepository resumeRepository,
                                 ResumeAnalysisRepository analysisRepository,
                                 OpenAiService openAiService,
                                 StorageService storageService,
                                 PdfTextExtractor pdfTextExtractor,
                                 ObjectMapper objectMapper) {
        this.resumeRepository = resumeRepository;
        this.analysisRepository = analysisRepository;
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
                        val.forEach(n -> {
                            if (!recommendsSummarySection(n.asText())) items.add(n.asText());
                        });
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

    private List<String> readStringList(JsonNode root, String field) {
        return readStringListFromNode(root, field);
    }

    private List<String> readStringListFromNode(JsonNode node, String field) {
        JsonNode arr = node.path(field);
        if (!arr.isArray()) return Collections.emptyList();
        List<String> result = new ArrayList<>();
        arr.forEach(n -> {
            if (!recommendsSummarySection(n.asText())) result.add(n.asText());
        });
        return result;
    }

    // Summary/objective sections are not wanted in this grader's advice (the prompt says so;
    // this is the backstop for when the model suggests one anyway).
    private static final java.util.regex.Pattern SUMMARY_SECTION = java.util.regex.Pattern.compile(
            "(?i)\\b(professional summary|career summary|summary (statement|section)|"
                    + "objective( statement| section)?|personal statement|profile (statement|section|summary)|"
                    + "add a (brief )?summary)\\b");

    static boolean recommendsSummarySection(String text) {
        return text != null && SUMMARY_SECTION.matcher(text).find();
    }

    /** Drops summary-section advice from a stored list; used when serving analyses saved before the rule existed. */
    public static List<String> withoutSummaryAdvice(List<String> items) {
        if (items == null) return null;
        List<String> kept = new ArrayList<>();
        for (String item : items) {
            if (!recommendsSummarySection(item)) kept.add(item);
        }
        return kept;
    }

    /** Same for a free-text verdict: drops only the sentences that push a summary section. */
    public static String withoutSummaryAdvice(String verdict) {
        if (verdict == null || !recommendsSummarySection(verdict)) return verdict;
        StringBuilder kept = new StringBuilder();
        for (String sentence : verdict.split("(?<=[.!?])\\s+")) {
            if (recommendsSummarySection(sentence)) continue;
            if (kept.length() > 0) kept.append(' ');
            kept.append(sentence);
        }
        return kept.toString();
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

                Rules:
                - NEVER recommend adding a summary, objective, profile or personal statement. Recruiters skip them and
                  they waste space on a one-page resume. Do not list one in missing_sections, improvements or ats_issues,
                  do not lower any score because one is absent, and do not give it credit if present.
                - missing_sections may only name Education, Experience or Projects, and Skills, and only when truly absent.
                  An intern with no work history but strong projects is not missing Experience.
                - Judge on evidence: shipped projects with real users or scale, measurable results, depth and relevance of
                  the tech stack to the target role, internships and the company's bar, GPA only if listed and notable.
                - Penalize vague bullets, duplicated verbs, tutorial-clone projects with no differentiation, walls of
                  text, skills lists padded with things never used in a project or job, and multi-page length for new grads.
                - impact_language scores bullets for action verb, specific scope, and a metric or concrete outcome.
                - Improvements must be concrete edits to this resume's own content, never generic resume advice.
                """, userLevel, levelLabel, targetRole, resumeText, levelLabel, targetRole);
    }

    private static final String ANALYSIS_SYSTEM_PROMPT = """
            You are a senior technical recruiter at a FAANG-level company with 10+ years of experience \
            reviewing intern and new grad resumes. You have seen thousands of resumes and know exactly \
            what gets candidates interviews at top tech companies. \
            You give honest, specific, actionable feedback — not generic advice. \
            You reference specific details from the resume. You do not inflate scores. \
            You always respond with valid JSON only — no markdown formatting, no preamble.""";
}
