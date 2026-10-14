package dev.jobdog.backend.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    Optional<UserEntity> findByEmail(String email);

    boolean existsByEmail(String email);

    /**
     * Spends one resume upload. Atomic and conditional on a credit being left, so two
     * simultaneous uploads can't both spend the last one. Returns 0 when there are none.
     */
    @Transactional
    @Modifying
    @Query("UPDATE UserEntity u SET u.resumeCredits = u.resumeCredits - 1 WHERE u.id = :id AND u.resumeCredits > 0")
    int consumeResumeCredit(@Param("id") UUID id);

    @Transactional
    @Modifying
    @Query("UPDATE UserEntity u SET u.reportCreditProgress = u.reportCreditProgress + 1 WHERE u.id = :id")
    int bumpReportProgress(@Param("id") UUID id);

    /**
     * Turns {@code per} confirmations into one resume upload, never past {@code max}. The
     * progress is spent either way, so sitting at the cap doesn't bank unlimited progress.
     */
    @Transactional
    @Modifying
    @Query("UPDATE UserEntity u SET "
            + "u.resumeCredits = CASE WHEN u.resumeCredits < :max THEN u.resumeCredits + 1 ELSE u.resumeCredits END, "
            + "u.reportCreditProgress = u.reportCreditProgress - :per "
            + "WHERE u.id = :id AND u.reportCreditProgress >= :per")
    int redeemReportProgress(@Param("id") UUID id, @Param("per") int per, @Param("max") int max);

    /** Records activity, at most once per throttle window. */
    @Transactional
    @Modifying
    @Query("UPDATE UserEntity u SET u.lastSeenAt = :now WHERE u.id = :id AND (u.lastSeenAt IS NULL OR u.lastSeenAt < :threshold)")
    int touchLastSeen(@Param("id") UUID id, @Param("now") Instant now, @Param("threshold") Instant threshold);

    /** Reads credit state straight from the row, never from a stale cached entity. */
    @Query("SELECT u.resumeCredits AS resumeCredits, u.reportCreditProgress AS reportCreditProgress FROM UserEntity u WHERE u.id = :id")
    CreditsView creditsOf(@Param("id") UUID id);

    interface CreditsView {
        int getResumeCredits();

        int getReportCreditProgress();
    }
}
