package dev.jobdog.backend.savedjob;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SavedJobRepository extends JpaRepository<SavedJobEntity, UUID> {

    @Query("SELECT s FROM SavedJobEntity s JOIN FETCH s.job WHERE s.user.id = :userId ORDER BY s.savedAt DESC")
    List<SavedJobEntity> findByUser_IdOrderBySavedAtDesc(@Param("userId") UUID userId);

    Optional<SavedJobEntity> findByUser_IdAndJob_Id(UUID userId, UUID jobId);

    void deleteByUser_IdAndJob_Id(UUID userId, UUID jobId);
}
