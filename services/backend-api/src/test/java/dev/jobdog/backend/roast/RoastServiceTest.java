package dev.jobdog.backend.roast;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.theokanning.openai.completion.chat.ChatCompletionChoice;
import com.theokanning.openai.completion.chat.ChatCompletionResult;
import com.theokanning.openai.completion.chat.ChatMessage;
import com.theokanning.openai.service.OpenAiService;
import dev.jobdog.backend.job.JobRepository;
import dev.jobdog.backend.resume.*;
import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoastServiceTest {

    @Mock private ResumeRepository resumeRepository;
    @Mock private dev.jobdog.backend.job.JobRepository jobRepository;
    @Mock private UserRepository userRepository;
    @Mock private RoastHistoryRepository roastHistoryRepository;
    @Mock private OpenAiService openAiService;
    @Mock private StorageService storageService;
    @Mock private PdfTextExtractor pdfTextExtractor;
    @Mock private ResumeProfileRepository resumeProfileRepository;
    @Mock private dev.jobdog.backend.job.JobRequirementProfileRepository jobRequirementProfileRepository;
    @Mock private RedisTemplate<String, RoastGradeCacheEntry> roastGradeRedisTemplate;
    @Mock private ValueOperations<String, RoastGradeCacheEntry> valueOperations;

    @InjectMocks
    private RoastService roastService;

    private UUID userId;
    private UUID resumeId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        resumeId = UUID.randomUUID();

        UserEntity user = new UserEntity();
        ReflectionTestUtils.setField(user, "id", userId);

        ResumeEntity resume = new ResumeEntity();
        ReflectionTestUtils.setField(resume, "id", resumeId);
        resume.setUser(user);
        resume.setStatus(ResumeStatus.PARSED);
        resume.setStorageKey("resumes/" + resumeId + ".pdf");

        ResumeProfileEntity profile = new ResumeProfileEntity();
        profile.setSkills(List.of("Java", "Python", "Git"));
        profile.setYearsExperience(1);
        profile.setEducationLevel("Bachelor");

        lenient().when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        lenient().when(resumeRepository.findById(resumeId)).thenReturn(Optional.of(resume));
        lenient().when(resumeProfileRepository.findByResume_Id(resumeId)).thenReturn(Optional.of(profile));
        lenient().when(storageService.getObject(anyString())).thenReturn(new byte[]{1, 2, 3});
        lenient().when(pdfTextExtractor.extractText(any())).thenReturn("Some resume text about Java and Python projects.");
        lenient().when(roastGradeRedisTemplate.opsForValue()).thenReturn(valueOperations);

        ObjectMapper realMapper = new ObjectMapper();
        try {
            var field = RoastService.class.getDeclaredField("objectMapper");
            field.setAccessible(true);
            field.set(roastService, realMapper);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void roast_returnsCachedResultWithoutCallingOpenAiOnCacheHit() {
        RoastGradeCacheEntry cached = new RoastGradeCacheEntry(
                77, "GOOD_BOY", java.util.Map.of("writingQuality", 80.0), List.of("Strong Java projects"),
                "Cached roast text", List.of("AWS"));
        when(valueOperations.get(anyString())).thenReturn(cached);

        when(roastHistoryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        RoastHistoryEntity result = roastService.roast(userId, resumeId, null);

        assertEquals(77, result.getTopDogRank());
        assertEquals("GOOD_BOY", result.getTierName());
        verifyNoInteractions(openAiService);
    }

    @Test
    void roast_computesAndCachesOnCacheMiss() throws Exception {
        when(valueOperations.get(anyString())).thenReturn(null);

        ChatMessage assistantMessage = new ChatMessage("assistant",
                "{\"writing_quality_score\": 80, \"top_pros\": [\"Clear bullets\"], "
                        + "\"brutal_roast_text\": \"Not bad, kid.\", \"missing_dependencies\": [\"Docker\"]}");
        ChatCompletionChoice choice = new ChatCompletionChoice();
        choice.setMessage(assistantMessage);
        ChatCompletionResult result = new ChatCompletionResult();
        result.setChoices(List.of(choice));
        when(openAiService.createChatCompletion(any())).thenReturn(result);

        when(roastHistoryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        roastService.roast(userId, resumeId, null);

        verify(openAiService, times(1)).createChatCompletion(any());
        verify(valueOperations, times(1)).set(anyString(), any(RoastGradeCacheEntry.class));
        verify(roastHistoryRepository, times(1)).save(any());
    }
}
