package dev.jobdog.backend.benchmark;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BenchmarkJobRepository extends JpaRepository<BenchmarkJobEntity, UUID> {
    List<BenchmarkJobEntity> findAllByOrderByDifficultyLevelDesc();
}
