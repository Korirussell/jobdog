package dev.jobdog.backend.resume;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ResumeRepository extends JpaRepository<ResumeEntity, UUID> {

    List<ResumeEntity> findByUser_IdOrderByUploadedAtDesc(UUID userId);
}
