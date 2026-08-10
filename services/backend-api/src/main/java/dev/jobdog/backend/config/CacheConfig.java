package dev.jobdog.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import dev.jobdog.backend.roast.RoastGradeCacheEntry;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        ObjectMapper objectMapper = createJsonSerializingObjectMapper();

        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10))
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer(objectMapper)));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaultConfig)
                .withCacheConfiguration("jobs",
                    defaultConfig.entryTtl(Duration.ofMinutes(5)))
                .withCacheConfiguration("job-details",
                    defaultConfig.entryTtl(Duration.ofMinutes(15)))
                .build();
    }

    /**
     * This cache only ever stores {@link RoastGradeCacheEntry}, so it uses a type-specific
     * {@link Jackson2JsonRedisSerializer} rather than {@code GenericJackson2JsonRedisSerializer}.
     * The generic serializer, when handed an ObjectMapper without default typing enabled, writes
     * no {@code @class} hint and deserializes back into a raw LinkedHashMap — which then blows up
     * with a ClassCastException at the RedisTemplate call site on every cache hit. Binding the
     * target type explicitly avoids that without needing polymorphic default typing at all.
     * See RoastGradeCacheSerializationTest for the round-trip guard.
     */
    @Bean
    public RedisTemplate<String, RoastGradeCacheEntry> roastGradeRedisTemplate(RedisConnectionFactory connectionFactory) {
        ObjectMapper objectMapper = createJsonSerializingObjectMapper();

        RedisTemplate<String, RoastGradeCacheEntry> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new Jackson2JsonRedisSerializer<>(objectMapper, RoastGradeCacheEntry.class));
        template.afterPropertiesSet();
        return template;
    }

    private ObjectMapper createJsonSerializingObjectMapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }
}
