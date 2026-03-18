package dev.jobdog.backend.application;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApplicationRepository extends JpaRepository<ApplicationEntity, UUID> {

    Optional<ApplicationEntity> findByUser_IdAndJob_Id(UUID userId, UUID jobId);

    List<ApplicationEntity> findByJob_IdOrderByAppliedAtDesc(UUID jobId);

    List<ApplicationEntity> findByUser_IdOrderByAppliedAtDesc(UUID userId);
}
