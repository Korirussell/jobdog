package dev.jobdog.backend.benchmark;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApplicationScoreRepository extends JpaRepository<ApplicationScoreEntity, UUID> {

    Optional<ApplicationScoreEntity> findByApplication_Id(UUID applicationId);

    List<ApplicationScoreEntity> findByApplication_Job_IdOrderByMatchScoreDesc(UUID jobId);

    long countByApplication_Job_Id(UUID jobId);

    @Query(value = """
        SELECT CAST(
            (COUNT(*) FILTER (WHERE match_score <= :currentScore) * 100.0 / NULLIF(COUNT(*), 0))
        AS INTEGER)
        FROM application_scores
        WHERE application_id IN (
            SELECT id FROM applications WHERE job_id = :jobId
        )
        """, nativeQuery = true)
    Integer computePercentile(@Param("jobId") UUID jobId, @Param("currentScore") int currentScore);
}
