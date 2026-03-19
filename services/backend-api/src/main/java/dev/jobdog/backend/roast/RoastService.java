package dev.jobdog.backend.roast;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.theokanning.openai.completion.chat.ChatCompletionRequest;
import com.theokanning.openai.completion.chat.ChatMessage;
import com.theokanning.openai.service.OpenAiService;
import dev.jobdog.backend.job.JobEntity;
import dev.jobdog.backend.job.JobRepository;
import dev.jobdog.backend.resume.PdfTextExtractor;
import dev.jobdog.backend.resume.ResumeEntity;
import dev.jobdog.backend.resume.ResumeRepository;
import dev.jobdog.backend.resume.StorageService;
import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class RoastService {

    private final ResumeRepository resumeRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;
    private final RoastHistoryRepository roastHistoryRepository;
    private final OpenAiService openAiService;
    private final StorageService storageService;
    private final PdfTextExtractor pdfTextExtractor;
    private final ObjectMapper objectMapper;

    public RoastService(ResumeRepository resumeRepository,
                        JobRepository jobRepository,
                        UserRepository userRepository,
                        RoastHistoryRepository roastHistoryRepository,
                        OpenAiService openAiService,
                        StorageService storageService,
                        PdfTextExtractor pdfTextExtractor,
                        ObjectMapper objectMapper) {
        this.resumeRepository = resumeRepository;
        this.jobRepository = jobRepository;
        this.userRepository = userRepository;
        this.roastHistoryRepository = roastHistoryRepository;
        this.openAiService = openAiService;
        this.storageService = storageService;
        this.pdfTextExtractor = pdfTextExtractor;
        this.objectMapper = objectMapper;
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

        // jobId is optional — null means a general "intern/new-grad SWE" roast
        JobEntity job = null;
        if (jobId != null) {
            job = jobRepository.findById(jobId)
                    .orElseThrow(() -> new IllegalArgumentException("Job not found"));
        }

        byte[] pdfBytes = storageService.getObject(resume.getStorageKey());
        String resumeText = pdfTextExtractor.extractText(pdfBytes);

        String prompt = (job != null)
                ? buildRoastPrompt(resumeText, job.getDescriptionText(), job.getTitle(), job.getCompany())
                : buildGeneralRoastPrompt(resumeText);

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("gpt-4o-mini")
                .messages(List.of(
                        new ChatMessage("system", ROAST_SYSTEM_PROMPT),
                        new ChatMessage("user", prompt)
                ))
                .temperature(0.8)
                .maxTokens(1500)
                .build();

        String response = openAiService.createChatCompletion(request)
                .getChoices()
                .get(0)
                .getMessage()
                .getContent();

        try {
            JsonNode json = objectMapper.readTree(response);

            String brutalRoastText = json.has("brutal_roast_text")
                    ? json.get("brutal_roast_text").asText()
                    : "Failed to generate roast. Your resume broke the AI. That's... actually impressive.";

            List<String> missingDependencies = new ArrayList<>();
            if (json.has("missing_dependencies") && json.get("missing_dependencies").isArray()) {
                json.get("missing_dependencies").forEach(dep -> missingDependencies.add(dep.asText()));
            }

            int topDogRank = json.has("top_dog_rank") ? json.get("top_dog_rank").asInt() : 50;
            topDogRank = Math.max(0, Math.min(100, topDogRank));
            String tierName = rankToTier(topDogRank);

            RoastHistoryEntity roast = new RoastHistoryEntity();
            roast.setUser(user);
            roast.setResume(resume);
            if (job != null) roast.setJob(job);
            roast.setBrutalRoastText(brutalRoastText);
            roast.setMissingDependencies(missingDependencies);
            roast.setTopDogRank(topDogRank);
            roast.setTierName(tierName);
            roast.setRoastedAt(Instant.now());

            return roastHistoryRepository.save(roast);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse roast response", e);
        }
    }

    static String rankToTier(int rank) {
        if (rank >= 90) return "ALPHA_DOG";
        if (rank >= 75) return "GOOD_BOY";
        if (rank >= 60) return "FETCH_PLAYER";
        if (rank >= 40) return "HOUSE_TRAINED";
        if (rank >= 20) return "LOST_PUPPY";
        return "POUND_CANDIDATE";
    }

    private String buildGeneralRoastPrompt(String resumeText) {
        String truncatedResume = resumeText.substring(0, Math.min(resumeText.length(), 3000));
        return String.format("""
                CANDIDATE RESUME:
                %s
                
                Analyze this resume as a general SWE intern / new-grad candidate. Return ONLY valid JSON:
                {
                  "brutal_roast_text": "A 2-3 paragraph brutal but funny roast of this resume for a typical SWE internship at a top tech company. Be cynical. Reference specific gaps, overinflated claims, and what's missing.",
                  "missing_dependencies": ["skill1", "skill2", "technology3"],
                  "top_dog_rank": 0-100
                }
                
                Scoring guide for top_dog_rank (for a general SWE intern role at a top company):
                IMPORTANT: Calibrate for New Grad/Intern level. A 100/100 does NOT require 10 years of experience.
                - 90-100: Exceptional for intern/new grad level. Multiple FAANG internships, strong projects, clear impact metrics.
                - 75-89: Strong candidate. 1-2 good internships, solid projects, mostly good formatting.
                - 60-74: Decent but clear gaps. Some experience, projects need more depth or metrics.
                - 40-59: Needs significant work. Weak experience section, vague bullets, formatting issues.
                - 20-39: Major gaps. Little relevant experience, no metrics, poor structure.
                - 0-19: Complete overhaul needed.
                
                Return ONLY the JSON object.
                """, truncatedResume);
    }

    private String buildRoastPrompt(String resumeText, String jobDescription, String jobTitle, String company) {
        String truncatedResume = resumeText.substring(0, Math.min(resumeText.length(), 3000));
        String truncatedJob = jobDescription.substring(0, Math.min(jobDescription.length(), 2000));

        return String.format("""
                TARGET JOB: %s at %s
                
                JOB DESCRIPTION:
                %s
                
                CANDIDATE RESUME:
                %s
                
                Analyze the resume against the job description. Return ONLY valid JSON:
                {
                  "brutal_roast_text": "A 2-3 paragraph brutal but funny roast of this resume for this specific job. Be cynical. Be a senior SWE doing a code review of their career. Reference specific gaps.",
                  "missing_dependencies": ["skill1", "skill2", "technology3"],
                  "top_dog_rank": 0-100
                }
                
                Scoring guide for top_dog_rank:
                IMPORTANT: Calibrate for New Grad/Intern level. A 100/100 means perfect for THIS role at THIS level.
                - 90-100: Resume is almost perfect for this role. Strong alignment, minor nitpicks only.
                - 75-89: Strong candidate, missing a few specific skills but good foundation.
                - 60-74: Decent but clear gaps. Some relevant experience but missing key requirements.
                - 40-59: Needs significant work for this role. Weak alignment with job requirements.
                - 20-39: Major misalignment between resume and role.
                - 0-19: Resume and job are in different universes.
                
                Return ONLY the JSON object.
                """, jobTitle, company, truncatedJob, truncatedResume);
    }

    private static final String ROAST_SYSTEM_PROMPT = """
            You are the Top Dog Resume Roaster - a cynical, brutally honest Senior Software Engineer \
            who reviews resumes like they're pull requests that should never have been opened. \
            \
            CRITICAL CALIBRATION: You are grading University Students and New Grads. \
            A 100/100 does NOT require 10 years of experience or principal engineer credentials. \
            A 100/100 means the resume perfectly demonstrates: \
            - High-impact internships at reputable companies (FAANG, unicorns, or strong startups) \
            - Strong backend/cloud projects with clear technical depth (distributed systems, databases, infrastructure) \
            - Clear metrics and quantifiable impact ("reduced latency by 40%", "served 1M users") \
            - Clean formatting and strong action verbs \
            \
            Calibrate your scoring out of 100 based strictly on New Grad/Intern expectations. \
            A typical strong intern resume should score 70-85. Reserve 90+ for truly exceptional candidates. \
            \
            You adopt the persona of a grizzled tech lead who has seen too many interns claim \
            "proficient in Python" after completing one Codecademy course. \
            Your roasts are funny, specific, and ultimately constructive - like a code review \
            that hurts but makes you better. You reference specific missing skills, overinflated claims, \
            and gaps between what the job wants and what the resume shows. \
            Always respond in valid JSON format only.""";
}
