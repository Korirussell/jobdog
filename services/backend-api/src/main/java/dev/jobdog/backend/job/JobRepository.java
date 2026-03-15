package dev.jobdog.backend.job;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface JobRepository extends JpaRepository<JobEntity, UUID> {

    List<JobEntity> findTop20ByStatusOrderByPostedAtDesc(JobStatus status);

    Optional<JobEntity> findBySourceUrl(String sourceUrl);
}
