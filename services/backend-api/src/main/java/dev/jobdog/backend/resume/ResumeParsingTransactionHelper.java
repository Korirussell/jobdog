package dev.jobdog.backend.resume;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Separate Spring bean so that @Transactional is applied via a real proxy,
 * not bypassed by a self-call inside ResumeParsingService.
 */
@Service
public class ResumeParsingTransactionHelper {

    private static final Logger log = LoggerFactory.getLogger(ResumeParsingTransactionHelper.class);

    private final ResumeRepository resumeRepository;
    private final ResumeProfileRepository resumeProfileRepository;

    public ResumeParsingTransactionHelper(ResumeRepository resumeRepository,
                                          ResumeProfileRepository resumeProfileRepository) {
        this.resumeRepository = resumeRepository;
        this.resumeProfileRepository = resumeProfileRepository;
    }

    @Transactional
    public void markProcessing(UUID resumeId) {
        resumeRepository.findById(resumeId).ifPresent(r -> {
            r.setStatus(ResumeStatus.PROCESSING);
            resumeRepository.save(r);
        });
    }

    @Transactional
    public void saveParsedProfile(UUID resumeId, List<String> skills, Integer yearsExperience, String educationLevel) {
        ResumeEntity resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new IllegalArgumentException("Resume not found: " + resumeId));

        ResumeProfileEntity profile = resumeProfileRepository.findByResume_Id(resumeId)
                .orElse(new ResumeProfileEntity());
        profile.setResume(resume);
        profile.setSkills(skills);
        profile.setYearsExperience(yearsExperience);
        profile.setEducationLevel(educationLevel);
        profile.setParserProvider("openai");
        profile.setParserModel("gpt-4o-mini");
        resumeProfileRepository.save(profile);

        resume.setStatus(ResumeStatus.PARSED);
        resumeRepository.save(resume);
        log.info("Saved parsed profile for resume {}", resumeId);
    }

    @Transactional
    public void markFailed(UUID resumeId) {
        resumeRepository.findById(resumeId).ifPresent(r -> {
            r.setStatus(ResumeStatus.FAILED);
            resumeRepository.save(r);
            log.warn("Marked resume {} as FAILED", resumeId);
        });
    }
}
