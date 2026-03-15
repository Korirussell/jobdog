package dev.jobdog.backend.benchmark;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApplicationScoreRepository extends JpaRepository<ApplicationScoreEntity, UUID> {

    Optional<ApplicationScoreEntity> findByApplication_Id(UUID applicationId);

    List<ApplicationScoreEntity> findByApplication_Job_IdOrderByMatchScoreDesc(UUID jobId);

    long countByApplication_Job_Id(UUID jobId);
}
