package dev.jobdog.backend.roast;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.theokanning.openai.completion.chat.ChatCompletionRequest;
import com.theokanning.openai.completion.chat.ChatMessage;
import com.theokanning.openai.service.OpenAiService;
import dev.jobdog.backend.job.JobEntity;
import dev.jobdog.backend.job.JobRepository;
import dev.jobdog.backend.job.JobRequirementProfileEntity;
import dev.jobdog.backend.job.JobRequirementProfileRepository;
import dev.jobdog.backend.resume.*;
import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.UUID;

@Service
public class RoastService {

    private static final Logger log = LoggerFactory.getLogger(RoastService.class);

    // Cache-key version for the scoring pipeline. Bump this whenever scoring logic changes
    // (weights, GENERAL_* skill baselines, resume parser output, or prompt-driven sub-scores)
    // so previously-cached grades are invalidated instead of being served for the rest of their TTL.
    private static final String GRADING_VERSION = "v1";

    private static final List<String> GENERAL_REQUIRED_SKILLS =
            List.of("Data Structures", "Algorithms", "Git", "SQL");
    private static final List<String> GENERAL_PREFERRED_SKILLS =
            List.of("React", "AWS", "Docker", "Kubernetes", "System Design", "CI/CD");
    private static final Duration CACHE_TTL = Duration.ofDays(90);

    private final ResumeRepository resumeRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;
    private final RoastHistoryRepository roastHistoryRepository;
    private final OpenAiService openAiService;
    private final StorageService storageService;
    private final PdfTextExtractor pdfTextExtractor;
    private final ObjectMapper objectMapper;
    private final ResumeProfileRepository resumeProfileRepository;
    private final JobRequirementProfileRepository jobRequirementProfileRepository;
    private final RedisTemplate<String, RoastGradeCacheEntry> roastGradeRedisTemplate;

    public RoastService(ResumeRepository resumeRepository,
                        JobRepository jobRepository,
                        UserRepository userRepository,
                        RoastHistoryRepository roastHistoryRepository,
                        OpenAiService openAiService,
                        StorageService storageService,
                        PdfTextExtractor pdfTextExtractor,
                        ObjectMapper objectMapper,
                        ResumeProfileRepository resumeProfileRepository,
                        JobRequirementProfileRepository jobRequirementProfileRepository,
                        RedisTemplate<String, RoastGradeCacheEntry> roastGradeRedisTemplate) {
        this.resumeRepository = resumeRepository;
        this.jobRepository = jobRepository;
        this.userRepository = userRepository;
        this.roastHistoryRepository = roastHistoryRepository;
        this.openAiService = openAiService;
        this.storageService = storageService;
        this.pdfTextExtractor = pdfTextExtractor;
        this.objectMapper = objectMapper;
        this.resumeProfileRepository = resumeProfileRepository;
        this.jobRequirementProfileRepository = jobRequirementProfileRepository;
        this.roastGradeRedisTemplate = roastGradeRedisTemplate;
    }

    @Transactional
    public RoastHistoryEntity roast(UUID userId, UUID resumeId, UUID jobId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        ResumeEntity resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new IllegalArgumentException("Resume not found"));
        if (!resume.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Resume does not belong to user");
        }

        JobEntity job = null;
        if (jobId != null) {
            job = jobRepository.findById(jobId)
                    .orElseThrow(() -> new IllegalArgumentException("Job not found"));
        }

        ResumeProfileEntity profile = resumeProfileRepository.findByResume_Id(resumeId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Resume must be fully parsed before grading. Current status: " + resume.getStatus()));

        byte[] pdfBytes = storageService.getObject(resume.getStorageKey());
        String resumeText = pdfTextExtractor.extractText(pdfBytes);
        String normalizedText = resumeText.trim().replaceAll("\\s+", " ").toLowerCase();
        String contentHash = sha256(
                GRADING_VERSION + "|" + normalizedText + "|" + (jobId != null ? jobId.toString() : "general"));

        RoastGradeCacheEntry cached = null;
        try {
            cached = roastGradeRedisTemplate.opsForValue().get(contentHash);
        } catch (Exception e) {
            log.warn("Redis read failed for grade cache key {} - recomputing grade", contentHash, e);
        }

        RoastGradeCacheEntry gradeResult = cached != null
                ? cached
                : computeGrade(contentHash, profile, job, resumeText);

        RoastHistoryEntity roast = new RoastHistoryEntity();
        roast.setUser(user);
        roast.setResume(resume);
        if (job != null) roast.setJob(job);
        roast.setContentHash(contentHash);
        roast.setBrutalRoastText(gradeResult.brutalRoastText());
        roast.setMissingDependencies(gradeResult.missingDependencies());
        roast.setTopDogRank(gradeResult.topDogRank());
        roast.setTierName(gradeResult.tierName());
        roast.setSubScores(gradeResult.subScores());
        roast.setTopPros(gradeResult.topPros());
        roast.setRoastedAt(Instant.now());

        return roastHistoryRepository.save(roast);
    }

    private RoastGradeCacheEntry computeGrade(String contentHash, ResumeProfileEntity profile, JobEntity job, String resumeText) {
        List<String> requiredSkills = GENERAL_REQUIRED_SKILLS;
        List<String> preferredSkills = GENERAL_PREFERRED_SKILLS;
        Integer requiredYears = null;
        String requiredEducation = null;

        if (job != null) {
            JobRequirementProfileEntity jobProfile = jobRequirementProfileRepository.findByJob_Id(job.getId())
                    .orElse(null);
            if (jobProfile != null) {
                requiredSkills = jobProfile.getRequiredSkills();
                preferredSkills = jobProfile.getPreferredSkills();
            }
            requiredYears = job.getMinimumYearsExperience();
            requiredEducation = job.getEducationLevel();
        }

        OptionalDouble requiredCoverage = ResumeScoringUtils.coverage(profile.getSkills(), requiredSkills);
        OptionalDouble preferredCoverage = ResumeScoringUtils.coverage(profile.getSkills(), preferredSkills);
        OptionalDouble experienceAlignment = ResumeScoringUtils.experienceAlignment(profile.getYearsExperience(), requiredYears);
        OptionalDouble educationAlignment = ResumeScoringUtils.educationAlignment(profile.getEducationLevel(), requiredEducation);

        String prompt = job != null
                ? buildJobRoastPrompt(resumeText, job.getDescriptionText(), job.getTitle(), job.getCompany())
                : buildGeneralRoastPrompt(resumeText);

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("gpt-4o-mini")
                .messages(List.of(
                        new ChatMessage("system", GRADING_SYSTEM_PROMPT),
                        new ChatMessage("user", prompt)
                ))
                .temperature(0.0)
                .maxTokens(1200)
                .build();

        String response = openAiService.createChatCompletion(request)
                .getChoices()
                .get(0)
                .getMessage()
                .getContent();

        double writingQuality;
        List<String> topPros = new ArrayList<>();
        String brutalRoastText;
        List<String> missingDependencies = new ArrayList<>();
        try {
            JsonNode json = objectMapper.readTree(response);
            writingQuality = json.has("writing_quality_score") ? json.get("writing_quality_score").asDouble() : 50.0;
            if (json.has("top_pros") && json.get("top_pros").isArray()) {
                json.get("top_pros").forEach(p -> topPros.add(p.asText()));
            }
            brutalRoastText = json.has("brutal_roast_text")
                    ? json.get("brutal_roast_text").asText()
                    : "Failed to generate roast. Your resume broke the AI. That's... actually impressive.";
            if (json.has("missing_dependencies") && json.get("missing_dependencies").isArray()) {
                json.get("missing_dependencies").forEach(dep -> missingDependencies.add(dep.asText()));
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse grading response", e);
        }

        double normalizedWritingQuality = Math.max(0, Math.min(100, writingQuality)) / 100.0;
        int topDogRank = ResumeScoringUtils.weightedPercent(
                ResumeScoringUtils.Weighted.of(requiredCoverage, 45),
                ResumeScoringUtils.Weighted.of(preferredCoverage, 15),
                ResumeScoringUtils.Weighted.of(experienceAlignment, 15),
                ResumeScoringUtils.Weighted.of(educationAlignment, 10),
                // Always present — the LLM writing-quality pass runs for every
                // roast regardless of whether the job stated any requirements.
                ResumeScoringUtils.Weighted.of(OptionalDouble.of(normalizedWritingQuality), 15)
        );
        topDogRank = Math.max(0, Math.min(100, topDogRank));
        String tierName = rankToTier(topDogRank);

        // LinkedHashMap: insertion-ordered and a plain, Jackson-friendly concrete type
        // (Map.of returns ImmutableCollections$MapN, which does not round-trip cleanly).
        Map<String, Double> subScores = new LinkedHashMap<>();
        requiredCoverage.ifPresent(v -> subScores.put("requiredSkillCoverage", v * 100));
        preferredCoverage.ifPresent(v -> subScores.put("preferredSkillCoverage", v * 100));
        experienceAlignment.ifPresent(v -> subScores.put("experienceAlignment", v * 100));
        educationAlignment.ifPresent(v -> subScores.put("educationAlignment", v * 100));
        subScores.put("writingQuality", writingQuality);

        RoastGradeCacheEntry entry = new RoastGradeCacheEntry(
                topDogRank, tierName, subScores, topPros, brutalRoastText, missingDependencies);
        try {
            roastGradeRedisTemplate.opsForValue().set(contentHash, entry, CACHE_TTL);
        } catch (Exception e) {
            log.warn("Redis write failed for grade cache key {} - returning freshly computed grade", contentHash, e);
        }
        return entry;
    }

    private static String buildGeneralRoastPrompt(String resumeText) {
        String truncatedResume = resumeText.substring(0, Math.min(resumeText.length(), 3000));
        return String.format("""
                CANDIDATE RESUME:
                %s

                Analyze this resume as a general SWE intern / new-grad candidate.
                Return ONLY valid JSON:
                {
                  "writing_quality_score": 0-100 (bullet clarity, action verbs, quantified impact),
                  "top_pros": ["strength1", "strength2", "strength3"],
                  "brutal_roast_text": "A 2-3 paragraph brutal but funny roast of this resume for a typical SWE internship at a top tech company. Be cynical. Reference specific gaps, overinflated claims, and what's missing.",
                  "missing_dependencies": ["skill1", "skill2", "technology3"]
                }

                Return ONLY the JSON object.
                """, truncatedResume);
    }

    private static String buildJobRoastPrompt(String resumeText, String jobDescription, String jobTitle, String company) {
        String truncatedResume = resumeText.substring(0, Math.min(resumeText.length(), 3000));
        String description = jobDescription != null ? jobDescription : "";
        String truncatedJob = description.substring(0, Math.min(description.length(), 2000));

        return String.format("""
                TARGET JOB: %s at %s

                JOB DESCRIPTION:
                %s

                CANDIDATE RESUME:
                %s

                Analyze the resume against the job description above.
                Return ONLY valid JSON:
                {
                  "writing_quality_score": 0-100 (bullet clarity, action verbs, quantified impact),
                  "top_pros": ["strength1", "strength2", "strength3"],
                  "brutal_roast_text": "A 2-3 paragraph brutal but funny roast of this resume for THIS specific job. Be cynical. Be a senior SWE doing a code review of their career. Reference specific gaps between the job description and the resume.",
                  "missing_dependencies": ["skill1", "skill2", "technology3"]
                }

                Return ONLY the JSON object.
                """, jobTitle, company, truncatedJob, truncatedResume);
    }

    static String rankToTier(int rank) {
        if (rank >= 90) return "ALPHA_DOG";
        if (rank >= 75) return "GOOD_BOY";
        if (rank >= 60) return "FETCH_PLAYER";
        if (rank >= 40) return "HOUSE_TRAINED";
        if (rank >= 20) return "LOST_PUPPY";
        return "POUND_CANDIDATE";
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static final String GRADING_SYSTEM_PROMPT = """
            You are the Top Dog Resume Grader - a cynical, brutally honest Senior Software Engineer \
            who reviews resumes like they're pull requests that should never have been opened. \
            \
            CRITICAL CALIBRATION: You are grading University Students and New Grads for SWE \
            internship/new-grad roles. A 100/100 does NOT require 10 years of experience or \
            principal engineer credentials. \
            \
            writing_quality_score (0-100) rates ONLY the writing craft of the resume, not seniority: \
            - bullet clarity and strong action verbs \
            - quantified, believable impact ("reduced latency by 40%", "served 1M users") \
            - clean, consistent, ATS-friendly formatting \
            A typical strong intern resume should score 70-85 on writing quality. \
            Reserve 90+ for genuinely exceptional writing. \
            \
            top_pros must be exactly 3 short, specific strengths of THIS resume (each under 60 \
            characters, phrased so a candidate would be happy to share them publicly). \
            \
            missing_dependencies are the concrete skills/technologies the resume is missing for \
            the target role. \
            \
            You adopt the persona of a grizzled tech lead who has seen too many interns claim \
            "proficient in Python" after completing one Codecademy course. \
            Your roasts are funny, specific, and ultimately constructive - like a code review \
            that hurts but makes you better. You reference specific missing skills, overinflated \
            claims, and gaps between what the job wants and what the resume shows. \
            Always respond in valid JSON format only.""";
}
