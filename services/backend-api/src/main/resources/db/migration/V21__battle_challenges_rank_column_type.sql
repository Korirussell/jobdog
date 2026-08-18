-- V20 declared these SMALLINT, but BattleChallengeEntity's fields are plain
-- int/Integer, which Hibernate maps to INTEGER — schema validation on boot
-- failed with a type mismatch. Widen to match the entity.
ALTER TABLE battle_challenges
    ALTER COLUMN creator_top_dog_rank TYPE INTEGER,
    ALTER COLUMN challenger_top_dog_rank TYPE INTEGER;
