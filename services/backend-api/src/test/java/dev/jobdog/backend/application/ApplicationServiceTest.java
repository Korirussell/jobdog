package dev.jobdog.backend.application;

import dev.jobdog.backend.benchmark.ApplicationScoreEntity;
import dev.jobdog.backend.benchmark.ApplicationScoreRepository;
import dev.jobdog.backend.job.JobEntity;
import dev.jobdog.backend.job.JobRepository;
import dev.jobdog.backend.job.JobRequirementProfileRepository;
import dev.jobdog.backend.resume.ResumeEntity;
import dev.jobdog.backend.resume.ResumeProfileRepository;
import dev.jobdog.backend.resume.ResumeRepository;
import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApplicationServiceTest {

    @Mock private ApplicationRepository applicationRepository;
    @Mock private ApplicationScoreRepository applicationScoreRepository;
    @Mock private UserRepository userRepository;
    @Mock private ResumeRepository resumeRepository;
    @Mock private ResumeProfileRepository resumeProfileRepository;
    @Mock private JobRepository jobRepository;
    @Mock private JobRequirementProfileRepository jobRequirementProfileRepository;

    @InjectMocks
    private ApplicationService applicationService;

    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
    }

    @Test
    void listApplications_batchFetchesScoresInsteadOfPerRow() {
        UserEntity user = new UserEntity();
        JobEntity job1 = new JobEntity();
        job1.setTitle("SWE Intern");
        job1.setCompany("Acme");
        ResumeEntity resume1 = new ResumeEntity();
        resume1.setLabel("default");

        ApplicationEntity app1 = new ApplicationEntity();
        app1.setUser(user);
        app1.setJob(job1);
        app1.setResume(resume1);
        app1.setStatus(ApplicationStatus.APPLIED);
        app1.setAppliedAt(Instant.now());

        ApplicationEntity app2 = new ApplicationEntity();
        app2.setUser(user);
        app2.setJob(job1);
        app2.setResume(resume1);
        app2.setStatus(ApplicationStatus.SCORED);
        app2.setAppliedAt(Instant.now());

        when(applicationRepository.findByUser_IdOrderByAppliedAtDesc(userId)).thenReturn(List.of(app1, app2));
        when(applicationScoreRepository.findByApplication_IdIn(anyList())).thenReturn(List.of());

        applicationService.listApplications(userId);

        // Exactly one batched score lookup, never a per-application lookup.
        verify(applicationScoreRepository, times(1)).findByApplication_IdIn(anyList());
        verify(applicationScoreRepository, never()).findByApplication_Id(any());
    }
}
