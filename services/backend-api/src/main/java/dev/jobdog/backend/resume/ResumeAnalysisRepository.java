package dev.jobdog.backend.resume;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ResumeAnalysisRepository extends JpaRepository<ResumeAnalysisEntity, UUID> {

    Optional<ResumeAnalysisEntity> findTopByResume_IdOrderByAnalyzedAtDesc(UUID resumeId);

    @Query("SELECT a FROM ResumeAnalysisEntity a WHERE a.resume.user.id = :userId ORDER BY a.overallScore DESC LIMIT 1")
    Optional<ResumeAnalysisEntity> findTopByUserIdOrderByScoreDesc(@Param("userId") UUID userId);
}
