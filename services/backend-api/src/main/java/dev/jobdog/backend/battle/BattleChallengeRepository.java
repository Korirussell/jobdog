package dev.jobdog.backend.battle;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BattleChallengeRepository extends JpaRepository<BattleChallengeEntity, UUID> {

    Optional<BattleChallengeEntity> findByToken(String token);

    List<BattleChallengeEntity> findByCreatorUserIdOrderByCreatedAtDesc(UUID creatorUserId);
}
