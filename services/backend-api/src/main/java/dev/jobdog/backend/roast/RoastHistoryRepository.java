package dev.jobdog.backend.roast;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RoastHistoryRepository extends JpaRepository<RoastHistoryEntity, UUID> {

    List<RoastHistoryEntity> findByUser_IdOrderByRoastedAtDesc(UUID userId);
}
