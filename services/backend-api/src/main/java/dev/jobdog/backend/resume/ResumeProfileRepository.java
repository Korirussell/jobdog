package dev.jobdog.backend.resume;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ResumeProfileRepository extends JpaRepository<ResumeProfileEntity, UUID> {

    Optional<ResumeProfileEntity> findByResume_Id(UUID resumeId);
    Optional<ResumeProfileEntity> findTopByResume_User_IdOrderByResume_UploadedAtDesc(UUID userId);
}
