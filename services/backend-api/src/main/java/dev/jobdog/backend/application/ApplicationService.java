package dev.jobdog.backend.application;

import dev.jobdog.backend.benchmark.ApplicationScoreEntity;
import dev.jobdog.backend.benchmark.ApplicationScoreRepository;
import dev.jobdog.backend.benchmark.BenchmarkState;
import dev.jobdog.backend.job.JobEntity;
import dev.jobdog.backend.job.JobRepository;
import dev.jobdog.backend.job.JobRequirementProfileEntity;
import dev.jobdog.backend.job.JobRequirementProfileRepository;
import dev.jobdog.backend.job.JobStatus;
import dev.jobdog.backend.resume.ResumeEntity;
import dev.jobdog.backend.resume.ResumeProfileEntity;
import dev.jobdog.backend.resume.ResumeProfileRepository;
import dev.jobdog.backend.resume.ResumeRepository;
import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

record ApplicationListItem(
        UUID applicationId,
        UUID jobId,
        String jobTitle,
        String company,
        String status,
        int matchScore,
        Integer percentile,
        int applicantCount,
        Instant appliedAt
) {}

@Service
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final ApplicationScoreRepository applicationScoreRepository;
    private final UserRepository userRepository;
    private final ResumeRepository resumeRepository;
    private final ResumeProfileRepository resumeProfileRepository;
    private final JobRepository jobRepository;
    private final JobRequirementProfileRepository jobRequirementProfileRepository;

    public ApplicationService(ApplicationRepository applicationRepository,
                              ApplicationScoreRepository applicationScoreRepository,
                              UserRepository userRepository,
                              ResumeRepository resumeRepository,
                              ResumeProfileRepository resumeProfileRepository,
                              JobRepository jobRepository,
                              JobRequirementProfileRepository jobRequirementProfileRepository) {
        this.applicationRepository = applicationRepository;
        this.applicationScoreRepository = applicationScoreRepository;
        this.userRepository = userRepository;
        this.resumeRepository = resumeRepository;
        this.resumeProfileRepository = resumeProfileRepository;
        this.jobRepository = jobRepository;
        this.jobRequirementProfileRepository = jobRequirementProfileRepository;
    }

    @Transactional
    public ApplicationResponse createApplication(UUID jobId, UUID authenticatedUserId, CreateApplicationRequest request) {
        if (applicationRepository.findByUser_IdAndJob_Id(authenticatedUserId, jobId).isPresent()) {
            throw new IllegalArgumentException("Application already exists for this user and job");
        }

        UserEntity user = userRepository.findById(authenticatedUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        ResumeEntity resume = resumeRepository.findById(request.resumeId())
                .orElseThrow(() -> new IllegalArgumentException("Resume not found"));
        JobEntity job = jobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found"));

        if (job.getStatus() != JobStatus.ACTIVE) {
            throw new IllegalArgumentException("Job is no longer active and cannot accept applications");
        }

        if (!resume.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Resume does not belong to user");
        }

        ResumeProfileEntity resumeProfile = resumeProfileRepository.findByResume_Id(resume.getId())
                .orElse(null);
        JobRequirementProfileEntity jobProfile = jobRequirementProfileRepository.findByJob_Id(job.getId())
                .orElse(null);

        ApplicationEntity application = new ApplicationEntity();
        application.setUser(user);
        application.setJob(job);
        application.setResume(resume);
        application.setStatus(ApplicationStatus.APPLIED);
        application.setAppliedAt(Instant.now());
        ApplicationEntity savedApplication = applicationRepository.save(application);

        // Only score if both profiles exist; otherwise record as APPLIED without a score
        if (resumeProfile != null && jobProfile != null) {
            ScoreComputation scoreComputation = computeScore(resumeProfile, jobProfile, job);
            long existingApplicantCount = applicationScoreRepository.countByApplication_Job_Id(jobId);
            int applicantCount = Math.toIntExact(existingApplicantCount + 1);

            ApplicationScoreEntity scoreEntity = new ApplicationScoreEntity();
            scoreEntity.setApplication(savedApplication);
            scoreEntity.setMatchScore(scoreComputation.matchScore());
            scoreEntity.setMatchBreakdown(scoreComputation.matchBreakdown());
            scoreEntity.setApplicantCount(applicantCount);
            scoreEntity.setScoredAt(Instant.now());

            if (applicantCount < 5) {
                scoreEntity.setBenchmarkState(BenchmarkState.EARLY_APPLICANT);
                scoreEntity.setPercentile(null);
            } else {
                int percentile = computePercentile(jobId, scoreComputation.matchScore());
                scoreEntity.setBenchmarkState(BenchmarkState.PERCENTILE_READY);
                scoreEntity.setPercentile(percentile);
            }

            applicationScoreRepository.save(scoreEntity);
            savedApplication.setStatus(ApplicationStatus.SCORED);

            return new ApplicationResponse(
                    savedApplication.getId(),
                    scoreEntity.getMatchScore(),
                    scoreEntity.getMatchBreakdown(),
                    scoreEntity.getBenchmarkState(),
                    scoreEntity.getBenchmarkState() == BenchmarkState.EARLY_APPLICANT
                            ? "Congrats, you are one of the first 5 applicants!"
                            : null,
                    scoreEntity.getPercentile(),
                    scoreEntity.getApplicantCount()
            );
        }

        return new ApplicationResponse(
                savedApplication.getId(),
                0,
                Map.of(),
                BenchmarkState.EARLY_APPLICANT,
                "Application tracked! Upload a resume to get a match score.",
                null,
                0
        );
    }

    private ScoreComputation computeScore(ResumeProfileEntity resumeProfile,
                                          JobRequirementProfileEntity jobProfile,
                                          JobEntity job) {
        double requiredCoverage = coverage(resumeProfile.getSkills(), jobProfile.getRequiredSkills());
        double preferredCoverage = coverage(resumeProfile.getSkills(), jobProfile.getPreferredSkills());
        double experienceAlignment = experienceAlignment(resumeProfile.getYearsExperience(), job.getMinimumYearsExperience());
        double educationAlignment = educationAlignment(resumeProfile.getEducationLevel(), job.getEducationLevel());

        int matchScore = (int) Math.round(
                (requiredCoverage * 60)
                        + (preferredCoverage * 15)
                        + (experienceAlignment * 15)
                        + (educationAlignment * 10)
        );

        Map<String, Object> breakdown = new HashMap<>();
        breakdown.put("requiredSkillCoverage", requiredCoverage);
        breakdown.put("preferredSkillCoverage", preferredCoverage);
        breakdown.put("experienceAlignment", experienceAlignment);
        breakdown.put("educationAlignment", educationAlignment);

        return new ScoreComputation(matchScore, breakdown);
    }

    private double coverage(List<String> candidateSkills, List<String> jobSkills) {
        if (jobSkills == null || jobSkills.isEmpty()) {
            return 1.0;
        }
        Set<String> normalizedCandidateSkills = normalize(candidateSkills);
        Set<String> normalizedJobSkills = normalize(jobSkills);
        long matched = normalizedJobSkills.stream().filter(normalizedCandidateSkills::contains).count();
        return (double) matched / normalizedJobSkills.size();
    }

    private Set<String> normalize(List<String> values) {
        Set<String> normalized = new HashSet<>();
        if (values == null) {
            return normalized;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                normalized.add(value.trim().toLowerCase());
            }
        }
        return normalized;
    }

    private double experienceAlignment(Integer candidateYears, Integer requiredYears) {
        if (requiredYears == null || requiredYears <= 0) {
            return 1.0;
        }
        if (candidateYears == null || candidateYears < 0) {
            return 0.0;
        }
        return Math.min(1.0, (double) candidateYears / requiredYears);
    }

    private double educationAlignment(String candidateEducation, String requiredEducation) {
        if (requiredEducation == null || requiredEducation.isBlank()) {
            return 1.0;
        }
        if (candidateEducation == null || candidateEducation.isBlank()) {
            return 0.0;
        }
        return candidateEducation.trim().equalsIgnoreCase(requiredEducation.trim()) ? 1.0 : 0.5;
    }

    private int computePercentile(UUID jobId, int currentScore) {
        Integer percentile = applicationScoreRepository.computePercentile(jobId, currentScore);
        return percentile != null ? percentile : 50;
    }

    @Transactional(readOnly = true)
    public List<ApplicationListItem> listApplications(UUID userId) {
        return applicationRepository.findByUser_IdOrderByAppliedAtDesc(userId).stream()
                .map(app -> {
                    var score = applicationScoreRepository.findByApplication_Id(app.getId()).orElse(null);
                    return new ApplicationListItem(
                            app.getId(),
                            app.getJob().getId(),
                            app.getJob().getTitle(),
                            app.getJob().getCompany(),
                            app.getStatus().name(),
                            score != null ? score.getMatchScore() : 0,
                            score != null ? score.getPercentile() : null,
                            score != null ? score.getApplicantCount() : 0,
                            app.getAppliedAt()
                    );
                })
                .toList();
    }

    @Transactional
    public void updateStatus(UUID applicationId, UUID userId, String newStatus) {
        ApplicationEntity app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));
        if (!app.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Application does not belong to user");
        }
        try {
            app.setStatus(ApplicationStatus.valueOf(newStatus.toUpperCase()));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid status: " + newStatus);
        }
        applicationRepository.save(app);
    }

    private record ScoreComputation(int matchScore, Map<String, Object> matchBreakdown) {
    }
}
