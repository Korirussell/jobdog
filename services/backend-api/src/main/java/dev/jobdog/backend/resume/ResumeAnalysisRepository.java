package dev.jobdog.backend.resume;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ResumeAnalysisRepository extends JpaRepository<ResumeAnalysisEntity, UUID> {

    Optional<ResumeAnalysisEntity> findTopByResume_IdOrderByAnalyzedAtDesc(UUID resumeId);

    Optional<ResumeAnalysisEntity> findTopByResume_User_IdOrderByOverallScoreDescAnalyzedAtDesc(UUID userId);

    /** Storage key of the resume behind the user's best analysis. Selects the key itself so no lazy association is touched. */
    @Query("select a.resume.storageKey from ResumeAnalysisEntity a where a.resume.user.id = :userId "
            + "order by a.overallScore desc, a.analyzedAt desc")
    List<String> findBestResumeStorageKeys(@Param("userId") UUID userId, Pageable page);

    void deleteByResume_Id(UUID resumeId);
}
