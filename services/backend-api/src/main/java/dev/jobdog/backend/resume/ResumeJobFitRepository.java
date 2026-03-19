package dev.jobdog.backend.resume;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ResumeJobFitRepository extends JpaRepository<ResumeJobFitEntity, UUID> {

    Optional<ResumeJobFitEntity> findByResume_IdAndJob_Id(UUID resumeId, UUID jobId);
}
