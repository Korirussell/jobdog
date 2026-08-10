package dev.jobdog.backend.config;

import dev.jobdog.backend.roast.RoastGradeCacheEntry;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.RedisSerializer;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;

/**
 * Guards the Redis round-trip for {@link RoastGradeCacheEntry}, which underpins the
 * "cache-guaranteed determinism" property of the grading pipeline: a cached grade must
 * deserialize back into an equal record, not a raw LinkedHashMap.
 */
class RoastGradeCacheSerializationTest {

    private static RoastGradeCacheEntry sampleEntry() {
        Map<String, Double> subScores = new LinkedHashMap<>();
        subScores.put("requiredSkillCoverage", 66.66666666666666);
        subScores.put("preferredSkillCoverage", 33.33333333333333);
        subScores.put("experienceAlignment", 100.0);
        subScores.put("educationAlignment", 100.0);
        subScores.put("writingQuality", 80.0);
        return new RoastGradeCacheEntry(
                78,
                "GOOD_BOY",
                subScores,
                List.of("Strong Java projects", "Quantified impact", "Clean formatting"),
                "Your resume compiles, but barely.",
                List.of("Docker", "Kubernetes"));
    }

    @SuppressWarnings("unchecked")
    private static RedisSerializer<Object> valueSerializer() {
        RedisTemplate<String, RoastGradeCacheEntry> template =
                new CacheConfig().roastGradeRedisTemplate(mock(RedisConnectionFactory.class));
        return (RedisSerializer<Object>) template.getValueSerializer();
    }

    @Test
    void roastGradeCacheEntryRoundTripsThroughConfiguredRedisSerializer() {
        RoastGradeCacheEntry original = sampleEntry();
        RedisSerializer<Object> serializer = valueSerializer();

        byte[] bytes = serializer.serialize(original);
        assertNotNull(bytes);

        Object deserialized = serializer.deserialize(bytes);

        assertEquals(RoastGradeCacheEntry.class, deserialized.getClass(),
                "Deserialized value must be a RoastGradeCacheEntry, not a raw Map "
                        + "(a raw Map would blow up as a ClassCastException at the RedisTemplate call site)");
        assertEquals(original, (RoastGradeCacheEntry) deserialized);
    }

    @Test
    void roundTripPreservesSubScoreOrderAndPrecision() {
        RoastGradeCacheEntry original = sampleEntry();
        RedisSerializer<Object> serializer = valueSerializer();

        RoastGradeCacheEntry back = (RoastGradeCacheEntry) serializer.deserialize(serializer.serialize(original));

        assertEquals(List.copyOf(original.subScores().keySet()), List.copyOf(back.subScores().keySet()));
        assertEquals(original.subScores().get("requiredSkillCoverage"), back.subScores().get("requiredSkillCoverage"));
        assertEquals(original.topPros(), back.topPros());
        assertEquals(original.missingDependencies(), back.missingDependencies());
        assertEquals(original.topDogRank(), back.topDogRank());
        assertEquals(original.tierName(), back.tierName());
        assertEquals(original.brutalRoastText(), back.brutalRoastText());
    }
}
