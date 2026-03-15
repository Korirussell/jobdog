package dev.jobdog.backend.resume;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.theokanning.openai.completion.chat.ChatCompletionRequest;
import com.theokanning.openai.completion.chat.ChatMessage;
import com.theokanning.openai.service.OpenAiService;
import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ResumeParsingService {

    private final ResumeRepository resumeRepository;
    private final ResumeProfileRepository resumeProfileRepository;
    private final UserRepository userRepository;
    private final PdfTextExtractor pdfTextExtractor;
    private final OpenAiService openAiService;
    private final StorageService storageService;
    private final ObjectMapper objectMapper;

    public ResumeParsingService(ResumeRepository resumeRepository,
                                ResumeProfileRepository resumeProfileRepository,
                                UserRepository userRepository,
                                PdfTextExtractor pdfTextExtractor,
                                OpenAiService openAiService,
                                StorageService storageService,
                                ObjectMapper objectMapper) {
        this.resumeRepository = resumeRepository;
        this.resumeProfileRepository = resumeProfileRepository;
        this.userRepository = userRepository;
        this.pdfTextExtractor = pdfTextExtractor;
        this.openAiService = openAiService;
        this.storageService = storageService;
        this.objectMapper = objectMapper;
    }

    @Async
    @Transactional
    public void parseResumeAsync(UUID resumeId, byte[] pdfBytes) {
        try {
            ResumeEntity resume = resumeRepository.findById(resumeId)
                    .orElseThrow(() -> new IllegalArgumentException("Resume not found"));

            resume.setStatus(ResumeStatus.PROCESSING);
            resumeRepository.save(resume);

            String extractedText = pdfTextExtractor.extractText(pdfBytes);

            String prompt = buildParsingPrompt(extractedText);

            ChatCompletionRequest request = ChatCompletionRequest.builder()
                    .model("gpt-4o-mini")
                    .messages(List.of(
                            new ChatMessage("system", "You are a resume parsing assistant. Extract structured data from resumes and return valid JSON only."),
                            new ChatMessage("user", prompt)
                    ))
                    .temperature(0.3)
                    .maxTokens(500)
                    .build();

            String response = openAiService.createChatCompletion(request)
                    .getChoices()
                    .get(0)
                    .getMessage()
                    .getContent();

            JsonNode jsonResponse = objectMapper.readTree(response);

            List<String> skills = new ArrayList<>();
            if (jsonResponse.has("skills") && jsonResponse.get("skills").isArray()) {
                jsonResponse.get("skills").forEach(skill -> skills.add(skill.asText()));
            }

            Integer yearsExperience = jsonResponse.has("yearsExperience") 
                    ? jsonResponse.get("yearsExperience").asInt() 
                    : null;

            String educationLevel = jsonResponse.has("educationLevel") 
                    ? jsonResponse.get("educationLevel").asText() 
                    : null;

            ResumeProfileEntity profile = new ResumeProfileEntity();
            profile.setResume(resume);
            profile.setSkills(skills);
            profile.setYearsExperience(yearsExperience);
            profile.setEducationLevel(educationLevel);
            profile.setParserProvider("openai");
            profile.setParserModel("gpt-4o-mini");
            resumeProfileRepository.save(profile);

            resume.setStatus(ResumeStatus.PARSED);
            resumeRepository.save(resume);

        } catch (Exception exception) {
            ResumeEntity resume = resumeRepository.findById(resumeId).orElse(null);
            if (resume != null) {
                resume.setStatus(ResumeStatus.FAILED);
                resumeRepository.save(resume);
            }
            throw new RuntimeException("Resume parsing failed", exception);
        }
    }

    private String buildParsingPrompt(String resumeText) {
        return String.format("""
                Extract the following information from this resume and return ONLY valid JSON with no additional text:
                
                {
                  "skills": ["skill1", "skill2", ...],
                  "yearsExperience": <integer>,
                  "educationLevel": "BACHELORS" | "MASTERS" | "PHD" | "ASSOCIATES" | "HIGH_SCHOOL" | null
                }
                
                Resume text:
                %s
                
                Return only the JSON object, no explanation.
                """, resumeText.substring(0, Math.min(resumeText.length(), 4000)));
    }
}
