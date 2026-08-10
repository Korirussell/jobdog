package dev.jobdog.backend.resume;

import dev.jobdog.backend.application.ApplicationEntity;
import dev.jobdog.backend.application.ApplicationRepository;
import dev.jobdog.backend.roast.RoastHistoryRepository;
import dev.jobdog.backend.user.UserEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationContext;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResumeServiceDeleteTest {

    @Mock private ResumeRepository resumeRepository;
    @Mock private dev.jobdog.backend.user.UserRepository userRepository;
    @Mock private StorageService storageService;
    @Mock private ResumeParsingService resumeParsingService;
    @Mock private ApplicationContext applicationContext;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private ResumeAnalysisRepository resumeAnalysisRepository;
    @Mock private ResumeJobFitRepository resumeJobFitRepository;
    @Mock private RoastHistoryRepository roastHistoryRepository;
    @Mock private ResumeProfileRepository resumeProfileRepository;

    @InjectMocks
    private ResumeService resumeService;

    private UUID userId;
    private UUID resumeId;
    private ResumeEntity resume;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        resumeId = UUID.randomUUID();
        UserEntity user = new UserEntity();
        ReflectionTestUtils.setField(user, "id", userId);
        resume = new ResumeEntity();
        ReflectionTestUtils.setField(resume, "id", resumeId);
        resume.setUser(user);
        resume.setStorageKey("resumes/" + resumeId + ".pdf");
        when(resumeRepository.findById(resumeId)).thenReturn(Optional.of(resume));
    }

    @Test
    void deleteResume_rejectsWhenResumeHasApplications() {
        when(applicationRepository.findByResume_Id(resumeId)).thenReturn(List.of(new ApplicationEntity()));

        assertThrows(ResumeInUseException.class, () -> resumeService.deleteResume(resumeId, userId));

        verify(resumeRepository, never()).delete(any());
    }

    @Test
    void deleteResume_cascadesDependentRowsThenDeletesResume() {
        when(applicationRepository.findByResume_Id(resumeId)).thenReturn(List.of());

        resumeService.deleteResume(resumeId, userId);

        verify(resumeJobFitRepository).deleteByResume_Id(resumeId);
        verify(resumeAnalysisRepository).deleteByResume_Id(resumeId);
        verify(roastHistoryRepository).deleteByResume_Id(resumeId);
        verify(resumeProfileRepository).deleteByResume_Id(resumeId);
        verify(resumeRepository).delete(resume);
    }
}
