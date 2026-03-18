package dev.jobdog.backend.savedjob;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SavedJobRepository extends JpaRepository<SavedJobEntity, UUID> {

    List<SavedJobEntity> findByUser_IdOrderBySavedAtDesc(UUID userId);

    Optional<SavedJobEntity> findByUser_IdAndJob_Id(UUID userId, UUID jobId);

    void deleteByUser_IdAndJob_Id(UUID userId, UUID jobId);
}
