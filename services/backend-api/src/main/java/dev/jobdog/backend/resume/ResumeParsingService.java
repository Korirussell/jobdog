package dev.jobdog.backend.resume;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.theokanning.openai.completion.chat.ChatCompletionRequest;
import com.theokanning.openai.completion.chat.ChatMessage;
import com.theokanning.openai.service.OpenAiService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ResumeParsingService {

    private static final Logger log = LoggerFactory.getLogger(ResumeParsingService.class);

    private final ResumeRepository resumeRepository;
    private final ResumeProfileRepository resumeProfileRepository;
    private final PdfTextExtractor pdfTextExtractor;
    private final OpenAiService openAiService;
    private final ObjectMapper objectMapper;
    private final ResumeParsingTransactionHelper transactionHelper;

    public ResumeParsingService(ResumeRepository resumeRepository,
                                ResumeProfileRepository resumeProfileRepository,
                                PdfTextExtractor pdfTextExtractor,
                                OpenAiService openAiService,
                                ObjectMapper objectMapper,
                                ResumeParsingTransactionHelper transactionHelper) {
        this.resumeRepository = resumeRepository;
        this.resumeProfileRepository = resumeProfileRepository;
        this.pdfTextExtractor = pdfTextExtractor;
        this.openAiService = openAiService;
        this.objectMapper = objectMapper;
        this.transactionHelper = transactionHelper;
    }

    /**
     * Entry point — runs on a separate async thread.
     * Delegates all DB writes to a @Transactional helper so the transaction
     * is properly bound to the async thread (not the caller's thread).
     */
    @Async
    public void parseResumeAsync(UUID resumeId, byte[] pdfBytes) {
        log.info("Starting async resume parsing for resumeId={} pdfSize={}bytes", resumeId, pdfBytes.length);
        try {
            transactionHelper.markProcessing(resumeId);

            String extractedText = pdfTextExtractor.extractText(pdfBytes);
            log.info("Extracted {} chars from resume {}", extractedText.length(), resumeId);

            // If we got no text at all, still try to parse with a note to the AI
            if (extractedText.isBlank()) {
                log.warn("Resume {} yielded no extractable text — attempting parse with empty content", resumeId);
                extractedText = "[No text could be extracted from this PDF. It may be image-based or encrypted.]";
            }

            String prompt = buildParsingPrompt(extractedText);

            ChatCompletionRequest request = ChatCompletionRequest.builder()
                    .model("gpt-4o-mini")
                    .messages(List.of(
                            new ChatMessage("system", "You are a resume parsing assistant. Extract structured data from resumes and return valid JSON only. If the resume text is unreadable, return empty arrays and null values."),
                            new ChatMessage("user", prompt)
                    ))
                    .temperature(0.1)
                    .maxTokens(1000)
                    .build();

            log.info("Calling OpenAI for resume {} ...", resumeId);
            String response = openAiService.createChatCompletion(request)
                    .getChoices()
                    .get(0)
                    .getMessage()
                    .getContent();

            log.info("OpenAI responded for resume {} ({} chars)", resumeId, response == null ? 0 : response.length());
            log.debug("OpenAI raw response for resume {}: {}", resumeId, response);

            String cleaned = stripMarkdown(response);
            JsonNode jsonResponse;
            try {
                jsonResponse = objectMapper.readTree(cleaned);
            } catch (Exception parseEx) {
                log.error("Failed to parse OpenAI JSON response for resume {}: {} | raw='{}'", resumeId, parseEx.getMessage(), cleaned);
                // Still mark as parsed with empty profile rather than FAILED
                transactionHelper.saveParsedProfile(resumeId, new ArrayList<>(), null, null);
                return;
            }

            List<String> skills = new ArrayList<>();
            if (jsonResponse.has("skills") && jsonResponse.get("skills").isArray()) {
                jsonResponse.get("skills").forEach(skill -> skills.add(skill.asText()));
            }

            Integer yearsExperience = jsonResponse.has("yearsExperience") && !jsonResponse.get("yearsExperience").isNull()
                    ? jsonResponse.get("yearsExperience").asInt()
                    : null;

            String educationLevel = jsonResponse.has("educationLevel") && !jsonResponse.get("educationLevel").isNull()
                    ? jsonResponse.get("educationLevel").asText()
                    : null;

            transactionHelper.saveParsedProfile(resumeId, skills, yearsExperience, educationLevel);
            log.info("Resume {} parsed successfully — {} skills, education={}", resumeId, skills.size(), educationLevel);

        } catch (Exception e) {
            log.error("Resume parsing failed for resumeId={}: {} ({})", resumeId, e.getMessage(), e.getClass().getSimpleName(), e);
            try {
                transactionHelper.markFailed(resumeId);
            } catch (Exception markEx) {
                log.error("Failed to mark resume {} as FAILED: {}", resumeId, markEx.getMessage(), markEx);
            }
        }
    }

    private String stripMarkdown(String text) {
        if (text == null) return "{}";
        String stripped = text.trim();
        if (stripped.startsWith("```")) {
            stripped = stripped.replaceAll("^```[a-zA-Z]*\\n?", "").replaceAll("```$", "").trim();
        }
        return stripped;
    }

    private String buildParsingPrompt(String resumeText) {
        return String.format("""
                Extract the following information from this resume and return ONLY valid JSON with no additional text:
                
                {
                  "skills": ["skill1", "skill2", ...],
                  "yearsExperience": <integer or null>,
                  "educationLevel": "BACHELORS" | "MASTERS" | "PHD" | "ASSOCIATES" | "HIGH_SCHOOL" | null
                }
                
                Resume text:
                %s
                
                Return only the JSON object, no markdown, no explanation.
                """, resumeText.substring(0, Math.min(resumeText.length(), 6000)));
    }
}
