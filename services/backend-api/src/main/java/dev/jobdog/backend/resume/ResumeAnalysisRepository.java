package dev.jobdog.backend.resume;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ResumeAnalysisRepository extends JpaRepository<ResumeAnalysisEntity, UUID> {

    Optional<ResumeAnalysisEntity> findTopByResume_IdOrderByAnalyzedAtDesc(UUID resumeId);
}
