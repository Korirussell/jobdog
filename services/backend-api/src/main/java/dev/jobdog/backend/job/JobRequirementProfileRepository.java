package dev.jobdog.backend.job;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface JobRequirementProfileRepository extends JpaRepository<JobRequirementProfileEntity, UUID> {

    Optional<JobRequirementProfileEntity> findByJob_Id(UUID jobId);
}
