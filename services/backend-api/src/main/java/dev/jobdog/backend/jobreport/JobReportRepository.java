package dev.jobdog.backend.jobreport;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface JobReportRepository extends JpaRepository<JobReportEntity, UUID> {

    Optional<JobReportEntity> findByJobIdAndUserId(UUID jobId, UUID userId);

    long countByJobIdAndVerdict(UUID jobId, String verdict);

    /** Reports this user filed since a point in time, for the daily earning cap. */
    long countByUserIdAndCreatedAtAfter(UUID userId, Instant since);

    /** The user's most recent verdicts, so the feed can show which listings they've already judged. */
    @Query("SELECT r FROM JobReportEntity r WHERE r.userId = :userId ORDER BY r.updatedAt DESC")
    List<JobReportEntity> findRecentByUser(@Param("userId") UUID userId, Pageable pageable);
}
