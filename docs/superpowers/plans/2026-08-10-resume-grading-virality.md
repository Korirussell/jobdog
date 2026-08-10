# Deterministic Resume Grading & Virality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make JobDog's resume score deterministic and cache-guaranteed, fix the broken resume-delete cascade, and ship shareable score cards + a self-battle comparison feature.

**Architecture:** `RoastService` is reworked in place (same public API, same dog-tier branding) to compute a hybrid score — deterministic rule-based sub-scores reused from `ApplicationService`'s existing matching logic, plus one temperature-0 LLM call for writing quality — cached in Redis by a SHA-256 hash of the resume text so identical input always returns the identical stored result. `ResumeService.deleteResume` is fixed to cascade-delete dependent rows instead of throwing an unhandled FK violation. Two new Next.js pieces (an `@vercel/og` image route and a battle page) are pure consumers of the existing/reworked `/api/v1/roast` endpoint — no new backend endpoints required for this plan's scope.

**Tech Stack:** Java 21 / Spring Boot 3.3.5 / Spring Data JPA / Spring Data Redis (`RedisTemplate`) / Flyway / `com.theokanning.openai-gpt3-java:service:0.18.2` / Next.js 15 (App Router) / `@vercel/og` / TypeScript / Vitest.

## Global Constraints

- Backend module root: `services/backend-api` (Maven, Java 21). Frontend module root: `services/frontend` (Next.js 15, npm).
- The OpenAI client library in use (`theokanning` 0.18.2) does not have a verified structured-output/JSON-schema mode in this codebase — every existing LLM call (`RoastService`, `ResumeAnalysisService`, `ResumeParsingService`) uses a plain prompt instructing "return ONLY valid JSON" plus manual `ObjectMapper.readTree` parsing. New LLM calls in this plan follow that same established pattern (temperature 0 for the deterministic sub-call) rather than introducing an unverified `response_format` API — determinism is guaranteed by the Redis cache, not by the LLM call itself.
- No Testcontainers/H2/real-DB test infrastructure exists in this repo yet (`services/backend-api/src/test` does not exist). This plan does not introduce one — all new backend tests are plain JUnit 5 + Mockito unit tests (already on the classpath via `spring-boot-starter-test`), no Spring context, no database.
- Money/version specifics only — no other project-wide constraints apply to this plan (AWS/Kafka/Databricks work is out of scope, see spec).

---

## File Structure

**Backend (`services/backend-api/src/main/java/dev/jobdog/backend/`):**
- `resume/ResumeScoringUtils.java` — **new**. Static deterministic scoring helpers, extracted from `ApplicationService` so both application-matching and resume-grading reuse the identical logic.
- `application/ApplicationService.java` — **modify**. Delegate `coverage`/`experienceAlignment`/`educationAlignment` to `ResumeScoringUtils`, remove the now-duplicate private methods.
- `resume/ResumeInUseException.java` — **new**. Thrown when a resume can't be deleted because an application references it.
- `common/api/GlobalExceptionHandler.java` — **modify**. Add a 409 handler for `ResumeInUseException`.
- `resume/ResumeService.java` — **modify**. `deleteResume` cascades dependent rows and rejects in-use resumes.
- `roast/RoastGradeCacheEntry.java` — **new**. Immutable cache/response payload (score, tier, sub-scores, top pros, roast text).
- `roast/RoastService.java` — **modify**. `roast()` becomes the hybrid deterministic+cached scorer described above.
- `roast/RoastHistoryEntity.java`, `RoastHistoryRepository.java` — **modify**. Add `contentHash` field/column.
- `roast/RoastController.java` — **modify**. Response includes `subScores` and `topPros`.
- `config/CacheConfig.java` — **modify**. Add a `RedisTemplate<String, RoastGradeCacheEntry>` bean.
- `src/main/resources/db/migration/V11__roast_history_content_hash.sql` — **new**.

**Backend tests (`services/backend-api/src/test/java/dev/jobdog/backend/`):**
- `resume/ResumeScoringUtilsTest.java` — **new**.
- `resume/ResumeServiceDeleteTest.java` — **new**.
- `roast/RoastServiceTest.java` — **new**.

**Frontend (`services/frontend/`):**
- `app/vault/page.tsx` — **modify**. Delete handler shows the server's actual message inline instead of `alert()`.
- `app/api/og/resume-card/route.tsx` — **new**. `@vercel/og` image renderer, Edge runtime.
- `components/ShareCardSheet.tsx` — **new**. Pre-share customization bottom sheet (toggle state → OG route query string → preview/download/share).
- `app/vault/page.tsx` and `app/u/[userId]/page.tsx` — **modify**. Wire in `ShareCardSheet` behind a "Share" button.
- `app/battle/page.tsx` — **new**. Resume Battle self-battle page.
- `lib/tiers.ts` — **new**. Single shared `TIERS` array (currently duplicated/inconsistent between `vault/page.tsx` and `u/[userId]/page.tsx`), used by all new UI.
- `package.json` — **modify**. Add `@vercel/og`.

---

### Task 1: Flyway migration — `content_hash` on `roast_history`

**Files:**
- Create: `services/backend-api/src/main/resources/db/migration/V11__roast_history_content_hash.sql`

**Interfaces:**
- Produces: column `roast_history.content_hash VARCHAR(64)`, indexed as `idx_roast_history_content_hash`. Consumed by Task 6 (`RoastHistoryEntity`).

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE roast_history
    ADD COLUMN content_hash VARCHAR(64);

CREATE INDEX idx_roast_history_content_hash ON roast_history (content_hash);
```

- [ ] **Step 2: Verify migration applies cleanly**

Run: `cd services/backend-api && mvn -q flyway:info -Dflyway.url=$SPRING_DATASOURCE_URL -Dflyway.user=$SPRING_DATASOURCE_USERNAME -Dflyway.password=$SPRING_DATASOURCE_PASSWORD 2>&1 || docker-compose up -d postgres && mvn spring-boot:run`

Expected: application starts and logs `Migrating schema "public" to version "11 - roast history content hash"` with no errors. (If you don't have a local Postgres running, start the stack's `postgres` service via `docker-compose up -d postgres` from the repo root first.)

- [ ] **Step 3: Commit**

```bash
git add services/backend-api/src/main/resources/db/migration/V11__roast_history_content_hash.sql
git commit -m "db: add content_hash column to roast_history for grade caching"
```

---

### Task 2: Redis template for grade caching

**Files:**
- Create: `services/backend-api/src/main/java/dev/jobdog/backend/roast/RoastGradeCacheEntry.java`
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/config/CacheConfig.java`

**Interfaces:**
- Produces: `record RoastGradeCacheEntry(...)` and bean `RedisTemplate<String, RoastGradeCacheEntry> roastGradeRedisTemplate`. Consumed by Task 6 (`RoastService`).

- [ ] **Step 1: Create the cache entry record**

```java
package dev.jobdog.backend.roast;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

public record RoastGradeCacheEntry(
        int topDogRank,
        String tierName,
        Map<String, Double> subScores,
        List<String> topPros,
        String brutalRoastText,
        List<String> missingDependencies
) implements Serializable {
}
```

- [ ] **Step 2: Add the RedisTemplate bean to `CacheConfig`**

Add this bean to `services/backend-api/src/main/java/dev/jobdog/backend/config/CacheConfig.java`, alongside the existing `cacheManager` bean (reuse the same `ObjectMapper`/`JavaTimeModule` setup already in that file — do not duplicate it, extract it to a local variable used by both beans):

```java
@Bean
public RedisTemplate<String, RoastGradeCacheEntry> roastGradeRedisTemplate(RedisConnectionFactory connectionFactory) {
    ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    RedisTemplate<String, RoastGradeCacheEntry> template = new RedisTemplate<>();
    template.setConnectionFactory(connectionFactory);
    template.setKeySerializer(new StringRedisSerializer());
    template.setValueSerializer(new GenericJackson2JsonRedisSerializer(objectMapper));
    template.afterPropertiesSet();
    return template;
}
```

Add the two new imports needed: `org.springframework.data.redis.core.RedisTemplate` and `dev.jobdog.backend.roast.RoastGradeCacheEntry`.

- [ ] **Step 3: Compile to verify wiring**

Run: `cd services/backend-api && mvn -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add services/backend-api/src/main/java/dev/jobdog/backend/roast/RoastGradeCacheEntry.java services/backend-api/src/main/java/dev/jobdog/backend/config/CacheConfig.java
git commit -m "feat: add Redis template for resume grade caching"
```

---

### Task 3: Extract `ResumeScoringUtils`, refactor `ApplicationService` to use it

**Files:**
- Create: `services/backend-api/src/main/java/dev/jobdog/backend/resume/ResumeScoringUtils.java`
- Test: `services/backend-api/src/test/java/dev/jobdog/backend/resume/ResumeScoringUtilsTest.java`
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/application/ApplicationService.java`

**Interfaces:**
- Produces: `ResumeScoringUtils.coverage(List<String>, List<String>) -> double`, `ResumeScoringUtils.experienceAlignment(Integer, Integer) -> double`, `ResumeScoringUtils.educationAlignment(String, String) -> double`. Consumed by Task 6 (`RoastService`) and by `ApplicationService` itself.

- [ ] **Step 1: Write the failing tests**

```java
package dev.jobdog.backend.resume;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ResumeScoringUtilsTest {

    @Test
    void coverage_returnsFullScoreWhenNoJobSkillsRequired() {
        assertEquals(1.0, ResumeScoringUtils.coverage(List.of("Java"), List.of()));
        assertEquals(1.0, ResumeScoringUtils.coverage(List.of("Java"), null));
    }

    @Test
    void coverage_matchesCaseInsensitively() {
        assertEquals(1.0, ResumeScoringUtils.coverage(List.of("java", "Python"), List.of("Java")));
    }

    @Test
    void coverage_returnsPartialScoreForPartialOverlap() {
        assertEquals(0.5, ResumeScoringUtils.coverage(List.of("Java"), List.of("Java", "Go")));
    }

    @Test
    void experienceAlignment_returnsFullScoreWhenNoRequirement() {
        assertEquals(1.0, ResumeScoringUtils.experienceAlignment(0, 0));
        assertEquals(1.0, ResumeScoringUtils.experienceAlignment(null, null));
    }

    @Test
    void experienceAlignment_returnsZeroWhenCandidateMissingButRequired() {
        assertEquals(0.0, ResumeScoringUtils.experienceAlignment(null, 2));
    }

    @Test
    void experienceAlignment_capsAtOneWhenCandidateExceedsRequirement() {
        assertEquals(1.0, ResumeScoringUtils.experienceAlignment(5, 2));
    }

    @Test
    void educationAlignment_returnsHalfScoreForMismatch() {
        assertEquals(0.5, ResumeScoringUtils.educationAlignment("Associate", "Bachelor"));
    }

    @Test
    void educationAlignment_returnsFullScoreForExactMatchIgnoringCase() {
        assertEquals(1.0, ResumeScoringUtils.educationAlignment("bachelor", "Bachelor"));
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail (class doesn't exist yet)**

Run: `cd services/backend-api && mvn -q test -Dtest=ResumeScoringUtilsTest`
Expected: COMPILATION ERROR — `ResumeScoringUtils` cannot be resolved.

- [ ] **Step 3: Create `ResumeScoringUtils` by moving the logic out of `ApplicationService`**

```java
package dev.jobdog.backend.resume;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Deterministic (non-LLM) resume-to-requirement scoring helpers, shared by
 * application match scoring and resume grading so both use identical rules.
 */
public final class ResumeScoringUtils {

    private ResumeScoringUtils() {
    }

    public static double coverage(List<String> candidateSkills, List<String> jobSkills) {
        if (jobSkills == null || jobSkills.isEmpty()) {
            return 1.0;
        }
        Set<String> normalizedCandidateSkills = normalize(candidateSkills);
        Set<String> normalizedJobSkills = normalize(jobSkills);
        long matched = normalizedJobSkills.stream().filter(normalizedCandidateSkills::contains).count();
        return (double) matched / normalizedJobSkills.size();
    }

    public static double experienceAlignment(Integer candidateYears, Integer requiredYears) {
        if (requiredYears == null || requiredYears <= 0) {
            return 1.0;
        }
        if (candidateYears == null || candidateYears < 0) {
            return 0.0;
        }
        return Math.min(1.0, (double) candidateYears / requiredYears);
    }

    public static double educationAlignment(String candidateEducation, String requiredEducation) {
        if (requiredEducation == null || requiredEducation.isBlank()) {
            return 1.0;
        }
        if (candidateEducation == null || candidateEducation.isBlank()) {
            return 0.0;
        }
        return candidateEducation.trim().equalsIgnoreCase(requiredEducation.trim()) ? 1.0 : 0.5;
    }

    private static Set<String> normalize(List<String> values) {
        Set<String> normalized = new HashSet<>();
        if (values == null) {
            return normalized;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                normalized.add(value.trim().toLowerCase());
            }
        }
        return normalized;
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd services/backend-api && mvn -q test -Dtest=ResumeScoringUtilsTest`
Expected: BUILD SUCCESS, 8 tests passed.

- [ ] **Step 5: Update `ApplicationService` to delegate to `ResumeScoringUtils` and delete the now-duplicate private methods**

In `services/backend-api/src/main/java/dev/jobdog/backend/application/ApplicationService.java`, add the import `dev.jobdog.backend.resume.ResumeScoringUtils`, then replace the body of `computeScore` to call the static utility instead of the private methods, and delete the now-unused private `coverage`, `experienceAlignment`, `educationAlignment`, and `normalize` methods entirely:

```java
private ScoreComputation computeScore(ResumeProfileEntity resumeProfile,
                                      JobRequirementProfileEntity jobProfile,
                                      JobEntity job) {
    double requiredCoverage = ResumeScoringUtils.coverage(resumeProfile.getSkills(), jobProfile.getRequiredSkills());
    double preferredCoverage = ResumeScoringUtils.coverage(resumeProfile.getSkills(), jobProfile.getPreferredSkills());
    double experienceAlignment = ResumeScoringUtils.experienceAlignment(resumeProfile.getYearsExperience(), job.getMinimumYearsExperience());
    double educationAlignment = ResumeScoringUtils.educationAlignment(resumeProfile.getEducationLevel(), job.getEducationLevel());

    int matchScore = (int) Math.round(
            (requiredCoverage * 60)
                    + (preferredCoverage * 15)
                    + (experienceAlignment * 15)
                    + (educationAlignment * 10)
    );

    Map<String, Object> breakdown = new HashMap<>();
    breakdown.put("requiredSkillCoverage", requiredCoverage);
    breakdown.put("preferredSkillCoverage", preferredCoverage);
    breakdown.put("experienceAlignment", experienceAlignment);
    breakdown.put("educationAlignment", educationAlignment);

    return new ScoreComputation(matchScore, breakdown);
}
```

- [ ] **Step 6: Compile and run the full backend test suite to confirm no regression**

Run: `cd services/backend-api && mvn -q test`
Expected: BUILD SUCCESS, no failures (this is a pure refactor — `ApplicationService`'s external behavior is unchanged).

- [ ] **Step 7: Commit**

```bash
git add services/backend-api/src/main/java/dev/jobdog/backend/resume/ResumeScoringUtils.java services/backend-api/src/test/java/dev/jobdog/backend/resume/ResumeScoringUtilsTest.java services/backend-api/src/main/java/dev/jobdog/backend/application/ApplicationService.java
git commit -m "refactor: extract deterministic scoring rules into ResumeScoringUtils"
```

---

### Task 4: `ResumeInUseException` + 409 handling

**Files:**
- Create: `services/backend-api/src/main/java/dev/jobdog/backend/resume/ResumeInUseException.java`
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/common/api/GlobalExceptionHandler.java`

**Interfaces:**
- Produces: `class ResumeInUseException extends RuntimeException`, mapped to HTTP 409. Consumed by Task 5 (`ResumeService`).

- [ ] **Step 1: Create the exception**

```java
package dev.jobdog.backend.resume;

public class ResumeInUseException extends RuntimeException {
    public ResumeInUseException(String message) {
        super(message);
    }
}
```

- [ ] **Step 2: Add a handler in `GlobalExceptionHandler`**

Add this handler above the existing `handleIllegalArgument` method in `services/backend-api/src/main/java/dev/jobdog/backend/common/api/GlobalExceptionHandler.java`, and add the import `dev.jobdog.backend.resume.ResumeInUseException`:

```java
@ExceptionHandler(ResumeInUseException.class)
public ResponseEntity<ApiErrorResponse> handleResumeInUse(ResumeInUseException exception, HttpServletRequest request) {
    return buildResponse(HttpStatus.CONFLICT, exception.getMessage(), request.getRequestURI());
}
```

- [ ] **Step 3: Compile**

Run: `cd services/backend-api && mvn -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add services/backend-api/src/main/java/dev/jobdog/backend/resume/ResumeInUseException.java services/backend-api/src/main/java/dev/jobdog/backend/common/api/GlobalExceptionHandler.java
git commit -m "feat: add 409 handling for resume-in-use deletes"
```

---

### Task 5: Fix `ResumeService.deleteResume` cascade

**Files:**
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/resume/ResumeService.java`
- Test: `services/backend-api/src/test/java/dev/jobdog/backend/resume/ResumeServiceDeleteTest.java`

**Interfaces:**
- Consumes: `ResumeInUseException` (Task 4). Repositories: `dev.jobdog.backend.application.ApplicationRepository` (needs a `List<ApplicationEntity> findByResume_Id(UUID resumeId)` — add this method to the repository if it doesn't already exist), `dev.jobdog.backend.resume.ResumeAnalysisRepository`, `dev.jobdog.backend.resume.ResumeJobFitRepository`, `dev.jobdog.backend.roast.RoastHistoryRepository`, `dev.jobdog.backend.resume.ResumeProfileRepository` (all deleteBy-by-resume methods added in this task where missing).

- [ ] **Step 1: Check whether `ApplicationRepository` has a resume-scoped finder; add one if not**

Read `services/backend-api/src/main/java/dev/jobdog/backend/application/ApplicationRepository.java`. If it does not already declare `List<ApplicationEntity> findByResume_Id(UUID resumeId)`, add it:

```java
List<ApplicationEntity> findByResume_Id(UUID resumeId);
```

- [ ] **Step 2: Add resume-scoped delete methods to the four dependent repositories**

Add to `ResumeAnalysisRepository`: `void deleteByResume_Id(UUID resumeId);`
Add to `ResumeJobFitRepository`: `void deleteByResume_Id(UUID resumeId);`
Add to `RoastHistoryRepository` (`services/backend-api/src/main/java/dev/jobdog/backend/roast/RoastHistoryRepository.java`): `void deleteByResume_Id(UUID resumeId);`
Add to `ResumeProfileRepository`: `void deleteByResume_Id(UUID resumeId);`

- [ ] **Step 3: Write the failing unit test**

```java
package dev.jobdog.backend.resume;

import dev.jobdog.backend.application.ApplicationEntity;
import dev.jobdog.backend.application.ApplicationRepository;
import dev.jobdog.backend.roast.RoastHistoryRepository;
import dev.jobdog.backend.user.UserEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationContext;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResumeServiceDeleteTest {

    @Mock private ResumeRepository resumeRepository;
    @Mock private dev.jobdog.backend.user.UserRepository userRepository;
    @Mock private StorageService storageService;
    @Mock private ResumeParsingService resumeParsingService;
    @Mock private ApplicationContext applicationContext;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private ResumeAnalysisRepository resumeAnalysisRepository;
    @Mock private ResumeJobFitRepository resumeJobFitRepository;
    @Mock private RoastHistoryRepository roastHistoryRepository;
    @Mock private ResumeProfileRepository resumeProfileRepository;

    @InjectMocks
    private ResumeService resumeService;

    private UUID userId;
    private UUID resumeId;
    private ResumeEntity resume;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        resumeId = UUID.randomUUID();
        UserEntity user = new UserEntity();
        user.setId(userId);
        resume = new ResumeEntity();
        resume.setId(resumeId);
        resume.setUser(user);
        resume.setStorageKey("resumes/" + resumeId + ".pdf");
        when(resumeRepository.findById(resumeId)).thenReturn(Optional.of(resume));
    }

    @Test
    void deleteResume_rejectsWhenResumeHasApplications() {
        when(applicationRepository.findByResume_Id(resumeId)).thenReturn(List.of(new ApplicationEntity()));

        assertThrows(ResumeInUseException.class, () -> resumeService.deleteResume(resumeId, userId));

        verify(resumeRepository, never()).delete(any());
    }

    @Test
    void deleteResume_cascadesDependentRowsThenDeletesResume() {
        when(applicationRepository.findByResume_Id(resumeId)).thenReturn(List.of());

        resumeService.deleteResume(resumeId, userId);

        verify(resumeJobFitRepository).deleteByResume_Id(resumeId);
        verify(resumeAnalysisRepository).deleteByResume_Id(resumeId);
        verify(roastHistoryRepository).deleteByResume_Id(resumeId);
        verify(resumeProfileRepository).deleteByResume_Id(resumeId);
        verify(resumeRepository).delete(resume);
    }
}
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd services/backend-api && mvn -q test -Dtest=ResumeServiceDeleteTest`
Expected: COMPILATION ERROR or FAILURE — `ResumeService` constructor doesn't accept the new repositories yet, and `deleteResume` doesn't cascade.

- [ ] **Step 5: Update `ResumeService`'s constructor and `deleteResume`**

Add the five new fields/constructor params (`ApplicationRepository applicationRepository`, `ResumeAnalysisRepository resumeAnalysisRepository`, `ResumeJobFitRepository resumeJobFitRepository`, `dev.jobdog.backend.roast.RoastHistoryRepository roastHistoryRepository`, `ResumeProfileRepository resumeProfileRepository`) to `ResumeService`'s existing constructor (append them after `ApplicationContext applicationContext`, assign each to a `private final` field), then replace `deleteResume`:

```java
@Transactional
public void deleteResume(UUID resumeId, UUID userId) {
    ResumeEntity resume = resumeRepository.findById(resumeId)
            .orElseThrow(() -> new IllegalArgumentException("Resume not found"));
    if (!resume.getUser().getId().equals(userId)) {
        throw new IllegalArgumentException("Resume does not belong to user");
    }

    long applicationCount = applicationRepository.findByResume_Id(resumeId).size();
    if (applicationCount > 0) {
        throw new ResumeInUseException(
                "Resume is attached to " + applicationCount + " application(s); remove those first");
    }

    resumeJobFitRepository.deleteByResume_Id(resumeId);
    resumeAnalysisRepository.deleteByResume_Id(resumeId);
    roastHistoryRepository.deleteByResume_Id(resumeId);
    resumeProfileRepository.deleteByResume_Id(resumeId);

    // Best-effort R2 deletion — don't fail the whole operation if storage delete fails
    if (resume.getStorageKey() != null && !resume.getStorageKey().startsWith("local-fallback/")) {
        try {
            storageService.deleteObject(resume.getStorageKey());
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(ResumeService.class)
                    .warn("Failed to delete R2 object for resume {}: {}", resumeId, e.getMessage());
        }
    }
    resumeRepository.delete(resume);
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd services/backend-api && mvn -q test -Dtest=ResumeServiceDeleteTest`
Expected: BUILD SUCCESS, 2 tests passed.

- [ ] **Step 7: Run the full backend suite**

Run: `cd services/backend-api && mvn -q test`
Expected: BUILD SUCCESS.

- [ ] **Step 8: Commit**

```bash
git add services/backend-api/src/main/java/dev/jobdog/backend/resume/ services/backend-api/src/main/java/dev/jobdog/backend/application/ApplicationRepository.java services/backend-api/src/main/java/dev/jobdog/backend/roast/RoastHistoryRepository.java services/backend-api/src/test/java/dev/jobdog/backend/resume/ResumeServiceDeleteTest.java
git commit -m "fix: cascade-delete dependent rows so resume deletion no longer 500s"
```

---

### Task 6: Hybrid deterministic + cached scoring in `RoastService`

**Files:**
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/roast/RoastService.java`
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/roast/RoastHistoryEntity.java`
- Test: `services/backend-api/src/test/java/dev/jobdog/backend/roast/RoastServiceTest.java`

**Interfaces:**
- Consumes: `ResumeScoringUtils` (Task 3), `RoastGradeCacheEntry` + `roastGradeRedisTemplate` (Task 2), `ResumeProfileRepository.findByResume_Id(UUID) -> Optional<ResumeProfileEntity>` (existing), `JobRequirementProfileRepository.findByJob_Id(UUID) -> Optional<JobRequirementProfileEntity>` (existing).
- Produces: `RoastService.roast(UUID userId, UUID resumeId, UUID jobId) -> RoastHistoryEntity` (signature unchanged — same public API `RoastController` already calls), now with `getSubScores()`/`getTopPros()`/`getContentHash()` added to `RoastHistoryEntity`. Consumed by Task 7 (`RoastController`).

- [ ] **Step 1: Add `contentHash`, `subScores`, and `topPros` to `RoastHistoryEntity`**

Add these fields (with getters/setters, following the existing `missingDependencies` pattern for the JSON list/map columns) to `services/backend-api/src/main/java/dev/jobdog/backend/roast/RoastHistoryEntity.java`:

```java
@Column(length = 64)
private String contentHash;

@org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
@Column(columnDefinition = "jsonb")
private java.util.Map<String, Double> subScores;

@Convert(converter = StringListConverter.class)
@Column(columnDefinition = "jsonb")
private List<String> topPros;

public String getContentHash() { return contentHash; }
public void setContentHash(String contentHash) { this.contentHash = contentHash; }
public java.util.Map<String, Double> getSubScores() { return subScores; }
public void setSubScores(java.util.Map<String, Double> subScores) { this.subScores = subScores; }
public List<String> getTopPros() { return topPros; }
public void setTopPros(List<String> topPros) { this.topPros = topPros; }
```

- [ ] **Step 2: Add a second Flyway migration for the two new nullable columns**

Create `services/backend-api/src/main/resources/db/migration/V12__roast_history_subscores.sql`:

```sql
ALTER TABLE roast_history
    ADD COLUMN sub_scores JSONB,
    ADD COLUMN top_pros JSONB;
```

- [ ] **Step 3: Write the failing unit test**

```java
package dev.jobdog.backend.roast;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.theokanning.openai.completion.chat.ChatCompletionChoice;
import com.theokanning.openai.completion.chat.ChatCompletionResult;
import com.theokanning.openai.completion.chat.ChatMessage;
import com.theokanning.openai.service.OpenAiService;
import dev.jobdog.backend.job.JobRepository;
import dev.jobdog.backend.resume.*;
import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoastServiceTest {

    @Mock private ResumeRepository resumeRepository;
    @Mock private dev.jobdog.backend.job.JobRepository jobRepository;
    @Mock private UserRepository userRepository;
    @Mock private RoastHistoryRepository roastHistoryRepository;
    @Mock private OpenAiService openAiService;
    @Mock private StorageService storageService;
    @Mock private PdfTextExtractor pdfTextExtractor;
    @Mock private ResumeProfileRepository resumeProfileRepository;
    @Mock private dev.jobdog.backend.job.JobRequirementProfileRepository jobRequirementProfileRepository;
    @Mock private RedisTemplate<String, RoastGradeCacheEntry> roastGradeRedisTemplate;
    @Mock private ValueOperations<String, RoastGradeCacheEntry> valueOperations;

    @InjectMocks
    private RoastService roastService;

    private UUID userId;
    private UUID resumeId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        resumeId = UUID.randomUUID();

        UserEntity user = new UserEntity();
        user.setId(userId);

        ResumeEntity resume = new ResumeEntity();
        resume.setId(resumeId);
        resume.setUser(user);
        resume.setStatus(ResumeStatus.PARSED);
        resume.setStorageKey("resumes/" + resumeId + ".pdf");

        ResumeProfileEntity profile = new ResumeProfileEntity();
        profile.setSkills(List.of("Java", "Python", "Git"));
        profile.setYearsExperience(1);
        profile.setEducationLevel("Bachelor");

        lenient().when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        lenient().when(resumeRepository.findById(resumeId)).thenReturn(Optional.of(resume));
        lenient().when(resumeProfileRepository.findByResume_Id(resumeId)).thenReturn(Optional.of(profile));
        lenient().when(storageService.getObject(anyString())).thenReturn(new byte[]{1, 2, 3});
        lenient().when(pdfTextExtractor.extractText(any())).thenReturn("Some resume text about Java and Python projects.");
        lenient().when(roastGradeRedisTemplate.opsForValue()).thenReturn(valueOperations);

        ObjectMapper realMapper = new ObjectMapper();
        try {
            var field = RoastService.class.getDeclaredField("objectMapper");
            field.setAccessible(true);
            field.set(roastService, realMapper);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void roast_returnsCachedResultWithoutCallingOpenAiOnCacheHit() {
        RoastGradeCacheEntry cached = new RoastGradeCacheEntry(
                77, "GOOD_BOY", java.util.Map.of("writingQuality", 80.0), List.of("Strong Java projects"),
                "Cached roast text", List.of("AWS"));
        when(valueOperations.get(anyString())).thenReturn(cached);

        RoastHistoryEntity result = roastService.roast(userId, resumeId, null);

        assertEquals(77, result.getTopDogRank());
        assertEquals("GOOD_BOY", result.getTierName());
        verifyNoInteractions(openAiService);
    }

    @Test
    void roast_computesAndCachesOnCacheMiss() throws Exception {
        when(valueOperations.get(anyString())).thenReturn(null);

        ChatMessage assistantMessage = new ChatMessage("assistant",
                "{\"writing_quality_score\": 80, \"top_pros\": [\"Clear bullets\"], "
                        + "\"brutal_roast_text\": \"Not bad, kid.\", \"missing_dependencies\": [\"Docker\"]}");
        ChatCompletionChoice choice = new ChatCompletionChoice();
        choice.setMessage(assistantMessage);
        ChatCompletionResult result = new ChatCompletionResult();
        result.setChoices(List.of(choice));
        when(openAiService.createChatCompletion(any())).thenReturn(result);

        RoastHistoryEntity saved = new RoastHistoryEntity();
        when(roastHistoryRepository.save(any())).thenReturn(saved);

        roastService.roast(userId, resumeId, null);

        verify(openAiService, times(1)).createChatCompletion(any());
        verify(valueOperations, times(1)).set(anyString(), any(RoastGradeCacheEntry.class));
        verify(roastHistoryRepository, times(1)).save(any());
    }
}
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd services/backend-api && mvn -q test -Dtest=RoastServiceTest`
Expected: COMPILATION ERROR — `RoastService` doesn't yet have the new constructor dependencies or caching behavior.

- [ ] **Step 5: Rewrite `RoastService`**

Replace the full contents of `services/backend-api/src/main/java/dev/jobdog/backend/roast/RoastService.java`:

```java
package dev.jobdog.backend.roast;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.theokanning.openai.completion.chat.ChatCompletionRequest;
import com.theokanning.openai.completion.chat.ChatMessage;
import com.theokanning.openai.service.OpenAiService;
import dev.jobdog.backend.job.JobEntity;
import dev.jobdog.backend.job.JobRepository;
import dev.jobdog.backend.job.JobRequirementProfileEntity;
import dev.jobdog.backend.job.JobRequirementProfileRepository;
import dev.jobdog.backend.resume.*;
import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RoastService {

    private static final List<String> GENERAL_REQUIRED_SKILLS =
            List.of("Data Structures", "Algorithms", "Git", "SQL");
    private static final List<String> GENERAL_PREFERRED_SKILLS =
            List.of("React", "AWS", "Docker", "Kubernetes", "System Design", "CI/CD");

    private final ResumeRepository resumeRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;
    private final RoastHistoryRepository roastHistoryRepository;
    private final OpenAiService openAiService;
    private final StorageService storageService;
    private final PdfTextExtractor pdfTextExtractor;
    private final ObjectMapper objectMapper;
    private final ResumeProfileRepository resumeProfileRepository;
    private final JobRequirementProfileRepository jobRequirementProfileRepository;
    private final RedisTemplate<String, RoastGradeCacheEntry> roastGradeRedisTemplate;

    public RoastService(ResumeRepository resumeRepository,
                        JobRepository jobRepository,
                        UserRepository userRepository,
                        RoastHistoryRepository roastHistoryRepository,
                        OpenAiService openAiService,
                        StorageService storageService,
                        PdfTextExtractor pdfTextExtractor,
                        ObjectMapper objectMapper,
                        ResumeProfileRepository resumeProfileRepository,
                        JobRequirementProfileRepository jobRequirementProfileRepository,
                        RedisTemplate<String, RoastGradeCacheEntry> roastGradeRedisTemplate) {
        this.resumeRepository = resumeRepository;
        this.jobRepository = jobRepository;
        this.userRepository = userRepository;
        this.roastHistoryRepository = roastHistoryRepository;
        this.openAiService = openAiService;
        this.storageService = storageService;
        this.pdfTextExtractor = pdfTextExtractor;
        this.objectMapper = objectMapper;
        this.resumeProfileRepository = resumeProfileRepository;
        this.jobRequirementProfileRepository = jobRequirementProfileRepository;
        this.roastGradeRedisTemplate = roastGradeRedisTemplate;
    }

    @Transactional
    public RoastHistoryEntity roast(UUID userId, UUID resumeId, UUID jobId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        ResumeEntity resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new IllegalArgumentException("Resume not found"));
        if (!resume.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Resume does not belong to user");
        }

        JobEntity job = null;
        if (jobId != null) {
            job = jobRepository.findById(jobId)
                    .orElseThrow(() -> new IllegalArgumentException("Job not found"));
        }

        ResumeProfileEntity profile = resumeProfileRepository.findByResume_Id(resumeId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Resume must be fully parsed before grading. Current status: " + resume.getStatus()));

        byte[] pdfBytes = storageService.getObject(resume.getStorageKey());
        String resumeText = pdfTextExtractor.extractText(pdfBytes);
        String normalizedText = resumeText.trim().replaceAll("\\s+", " ").toLowerCase();
        String contentHash = sha256(normalizedText + "|" + (jobId != null ? jobId.toString() : "general"));

        RoastGradeCacheEntry cached = roastGradeRedisTemplate.opsForValue().get(contentHash);
        RoastGradeCacheEntry gradeResult = cached != null
                ? cached
                : computeGrade(contentHash, profile, job, resumeText);

        RoastHistoryEntity roast = new RoastHistoryEntity();
        roast.setUser(user);
        roast.setResume(resume);
        if (job != null) roast.setJob(job);
        roast.setContentHash(contentHash);
        roast.setBrutalRoastText(gradeResult.brutalRoastText());
        roast.setMissingDependencies(gradeResult.missingDependencies());
        roast.setTopDogRank(gradeResult.topDogRank());
        roast.setTierName(gradeResult.tierName());
        roast.setSubScores(gradeResult.subScores());
        roast.setTopPros(gradeResult.topPros());
        roast.setRoastedAt(Instant.now());

        return roastHistoryRepository.save(roast);
    }

    private RoastGradeCacheEntry computeGrade(String contentHash, ResumeProfileEntity profile, JobEntity job, String resumeText) {
        List<String> requiredSkills = GENERAL_REQUIRED_SKILLS;
        List<String> preferredSkills = GENERAL_PREFERRED_SKILLS;
        Integer requiredYears = null;
        String requiredEducation = null;

        if (job != null) {
            JobRequirementProfileEntity jobProfile = jobRequirementProfileRepository.findByJob_Id(job.getId())
                    .orElse(null);
            if (jobProfile != null) {
                requiredSkills = jobProfile.getRequiredSkills();
                preferredSkills = jobProfile.getPreferredSkills();
            }
            requiredYears = job.getMinimumYearsExperience();
            requiredEducation = job.getEducationLevel();
        }

        double requiredCoverage = ResumeScoringUtils.coverage(profile.getSkills(), requiredSkills);
        double preferredCoverage = ResumeScoringUtils.coverage(profile.getSkills(), preferredSkills);
        double experienceAlignment = ResumeScoringUtils.experienceAlignment(profile.getYearsExperience(), requiredYears);
        double educationAlignment = ResumeScoringUtils.educationAlignment(profile.getEducationLevel(), requiredEducation);

        String truncatedResume = resumeText.substring(0, Math.min(resumeText.length(), 3000));
        String prompt = String.format("""
                CANDIDATE RESUME:
                %s

                Return ONLY valid JSON:
                {
                  "writing_quality_score": 0-100 (bullet clarity, action verbs, quantified impact),
                  "top_pros": ["strength1", "strength2", "strength3"],
                  "brutal_roast_text": "A 2-3 paragraph brutal but funny roast of this resume for a New Grad/Intern SWE role. Be cynical but constructive.",
                  "missing_dependencies": ["skill1", "skill2"]
                }
                """, truncatedResume);

        ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("gpt-4o-mini")
                .messages(List.of(
                        new ChatMessage("system", GRADING_SYSTEM_PROMPT),
                        new ChatMessage("user", prompt)
                ))
                .temperature(0.0)
                .maxTokens(1200)
                .build();

        String response = openAiService.createChatCompletion(request)
                .getChoices()
                .get(0)
                .getMessage()
                .getContent();

        double writingQuality;
        List<String> topPros = new ArrayList<>();
        String brutalRoastText;
        List<String> missingDependencies = new ArrayList<>();
        try {
            JsonNode json = objectMapper.readTree(response);
            writingQuality = json.has("writing_quality_score") ? json.get("writing_quality_score").asDouble() : 50.0;
            if (json.has("top_pros") && json.get("top_pros").isArray()) {
                json.get("top_pros").forEach(p -> topPros.add(p.asText()));
            }
            brutalRoastText = json.has("brutal_roast_text")
                    ? json.get("brutal_roast_text").asText()
                    : "Failed to generate roast. Your resume broke the AI. That's... actually impressive.";
            if (json.has("missing_dependencies") && json.get("missing_dependencies").isArray()) {
                json.get("missing_dependencies").forEach(dep -> missingDependencies.add(dep.asText()));
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse grading response", e);
        }

        int topDogRank = (int) Math.round(
                (requiredCoverage * 45)
                        + (preferredCoverage * 15)
                        + (experienceAlignment * 15)
                        + (educationAlignment * 10)
                        + (Math.max(0, Math.min(100, writingQuality)) / 100.0 * 15)
        );
        topDogRank = Math.max(0, Math.min(100, topDogRank));
        String tierName = rankToTier(topDogRank);

        Map<String, Double> subScores = Map.of(
                "requiredSkillCoverage", requiredCoverage,
                "preferredSkillCoverage", preferredCoverage,
                "experienceAlignment", experienceAlignment,
                "educationAlignment", educationAlignment,
                "writingQuality", writingQuality
        );

        RoastGradeCacheEntry entry = new RoastGradeCacheEntry(
                topDogRank, tierName, subScores, topPros, brutalRoastText, missingDependencies);
        roastGradeRedisTemplate.opsForValue().set(contentHash, entry);
        return entry;
    }

    static String rankToTier(int rank) {
        if (rank >= 90) return "ALPHA_DOG";
        if (rank >= 75) return "GOOD_BOY";
        if (rank >= 60) return "FETCH_PLAYER";
        if (rank >= 40) return "HOUSE_TRAINED";
        if (rank >= 20) return "LOST_PUPPY";
        return "POUND_CANDIDATE";
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static final String GRADING_SYSTEM_PROMPT = """
            You are the Top Dog Resume Grader - a cynical, brutally honest Senior Software Engineer \
            grading University Students and New Grads for SWE internship/new-grad roles. \
            A 100/100 writing_quality_score means perfectly clear bullets, strong action verbs, \
            and quantified impact ("reduced latency by 40%", "served 1M users") - not seniority. \
            A typical strong intern resume should score 70-85 on writing quality. \
            Your roasts are funny, specific, and ultimately constructive. \
            Always respond in valid JSON format only.""";
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd services/backend-api && mvn -q test -Dtest=RoastServiceTest`
Expected: BUILD SUCCESS, 2 tests passed.

- [ ] **Step 7: Run the full backend suite and compile**

Run: `cd services/backend-api && mvn -q test`
Expected: BUILD SUCCESS.

- [ ] **Step 8: Commit**

```bash
git add services/backend-api/src/main/java/dev/jobdog/backend/roast/ services/backend-api/src/main/resources/db/migration/V12__roast_history_subscores.sql services/backend-api/src/test/java/dev/jobdog/backend/roast/RoastServiceTest.java
git commit -m "feat: hybrid deterministic + Redis-cached resume grading"
```

---

### Task 7: Expose sub-scores and top pros from `RoastController`

**Files:**
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/roast/RoastController.java`
- Modify: `services/frontend/lib/api.ts`

**Interfaces:**
- Consumes: `RoastHistoryEntity.getSubScores()`, `.getTopPros()` (Task 6).
- Produces: `POST /api/v1/roast` response gains `subScores` and `topPros` fields, consumed by Task 10 (`ShareCardSheet`) and Task 11 (battle page).

- [ ] **Step 1: Update `roastResume` in `RoastController`**

```java
@PostMapping
public ResponseEntity<Map<String, Object>> roastResume(@RequestBody Map<String, String> body) {
    var userId = currentUser.require().userId();
    UUID resumeId = UUID.fromString(body.get("resumeId"));
    String jobIdStr = body.get("jobId");
    UUID jobId = (jobIdStr != null && !jobIdStr.isBlank()) ? UUID.fromString(jobIdStr) : null;

    RoastHistoryEntity roast = roastService.roast(userId, resumeId, jobId);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("brutalRoastText", roast.getBrutalRoastText());
    result.put("missingDependencies", roast.getMissingDependencies());
    result.put("topDogRank", roast.getTopDogRank());
    result.put("tierName", roast.getTierName());
    result.put("subScores", roast.getSubScores());
    result.put("topPros", roast.getTopPros());
    return ResponseEntity.ok(result);
}
```

- [ ] **Step 2: Update the frontend `roastResume`/`roastJob` response types in `services/frontend/lib/api.ts`**

Both methods share the same response shape — update it in both places (lines ~323-333 and ~375-385):

```ts
async roastResume(resumeId: string, jobId?: string) {
  return this.request<{
    brutalRoastText: string;
    missingDependencies: string[];
    topDogRank: number;
    tierName: string;
    subScores: Record<string, number>;
    topPros: string[];
  }>('/api/v1/roast', {
    method: 'POST',
    body: JSON.stringify({ resumeId, jobId: jobId ?? null }),
  });
}
```

Apply the same return-type change to `roastJob`.

- [ ] **Step 3: Compile backend**

Run: `cd services/backend-api && mvn -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Type-check frontend**

Run: `cd services/frontend && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 5: Commit**

```bash
git add services/backend-api/src/main/java/dev/jobdog/backend/roast/RoastController.java services/frontend/lib/api.ts
git commit -m "feat: expose sub-scores and top pros from the roast endpoint"
```

---

### Task 8: Fix vault delete UX (surface the real error, no more `alert()`)

**Files:**
- Modify: `services/frontend/app/vault/page.tsx`

**Interfaces:**
- Consumes: `api.deleteResume` (existing — `request()` already extracts `parsed.message` from the backend's `ApiErrorResponse` body, so the 409 message from Task 5 already reaches `err.message` with no `api.ts` changes needed).

- [ ] **Step 1: Add a `deleteError` state and replace the `alert()` call**

In `services/frontend/app/vault/page.tsx`, add `const [deleteError, setDeleteError] = useState<string | null>(null);` near the other `useState` declarations, then replace `handleDeleteResume`'s catch block:

```ts
async function handleDeleteResume(resumeId: string) {
  if (!confirm('Delete this resume? This cannot be undone.')) return;
  setDeletingId(resumeId);
  setDeleteError(null);
  try {
    await api.deleteResume(resumeId);
    setResumes((prev) => prev.filter((r) => r.resumeId !== resumeId));
    setAnalysisCache((prev) => { const next = { ...prev }; delete next[resumeId]; return next; });
    if (selectedResumeId === resumeId) {
      const remaining = resumes.filter((r) => r.resumeId !== resumeId);
      setSelectedResumeId(remaining.length > 0 ? remaining[0].resumeId : null);
    }
  } catch (err: any) {
    setDeleteError(err?.message || 'Failed to delete resume.');
  } finally {
    setDeletingId(null);
  }
}
```

- [ ] **Step 2: Render the error near the resume list**

Find the JSX block that renders the resume list in `vault/page.tsx` and add, immediately above it:

```tsx
{deleteError && (
  <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
    {deleteError}
  </div>
)}
```

- [ ] **Step 3: Manually verify in the browser**

Run: `cd services/frontend && npm run dev` (with the backend running via `docker-compose up -d`), then in the browser: upload a resume, wait for it to parse, apply to a job with it (creating an `applications` row), then attempt to delete that resume from `/vault`.
Expected: an inline red banner reading "Resume is attached to 1 application(s); remove those first" — no browser `alert()`, no unhandled 500.
Then delete a resume with no applications.
Expected: it disappears from the list with no error.

- [ ] **Step 4: Commit**

```bash
git add services/frontend/app/vault/page.tsx
git commit -m "fix: show real delete errors inline instead of alert()"
```

---

### Task 9: Shared tier module

**Files:**
- Create: `services/frontend/lib/tiers.ts`
- Modify: `services/frontend/app/vault/page.tsx`
- Modify: `services/frontend/app/u/[userId]/page.tsx`

**Interfaces:**
- Produces: `TIERS` array and `getTier(score: number)` function. Consumed by Task 10 (`ShareCardSheet`), Task 11 (battle page), and the two modified pages.

- [ ] **Step 1: Create the shared module**

```ts
export interface Tier {
  min: number;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  border: string;
  bar: string;
  desc: string;
}

export const TIERS: Tier[] = [
  { min: 90, label: 'ALPHA DOG', emoji: '🏆', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', bar: 'bg-emerald-500', desc: 'Top 5% of candidates. FAANG-ready.' },
  { min: 75, label: 'GOOD BOY', emoji: '🐕', color: 'text-lime-700', bg: 'bg-lime-50', border: 'border-lime-300', bar: 'bg-lime-500', desc: 'Strong candidate, minor gaps.' },
  { min: 60, label: 'FETCH PLAYER', emoji: '🎾', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', bar: 'bg-amber-500', desc: 'Decent, but clear gaps to close.' },
  { min: 40, label: 'HOUSE TRAINED', emoji: '🏠', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', bar: 'bg-orange-500', desc: 'Needs significant work.' },
  { min: 20, label: 'LOST PUPPY', emoji: '🐾', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', bar: 'bg-red-500', desc: 'Major gaps to address.' },
  { min: 0, label: 'POUND CANDIDATE', emoji: '🐩', color: 'text-red-900', bg: 'bg-red-100', border: 'border-red-400', bar: 'bg-red-700', desc: 'Complete overhaul needed.' },
];

export function getTier(score: number): Tier {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
}
```

- [ ] **Step 2: Replace the local `TIERS` array in `vault/page.tsx`**

Delete the local `TIERS` array and `getTier` function; add `import { TIERS, getTier } from '@/lib/tiers';` at the top instead.

- [ ] **Step 3: Replace the local `TIERS` array in `u/[userId]/page.tsx`**

Same change: delete the local (currently inconsistent, 5-tier) array, import the shared one instead. This fixes the pre-existing inconsistency between the two pages' tier definitions as a byproduct.

- [ ] **Step 4: Type-check and manually verify both pages still render tiers correctly**

Run: `cd services/frontend && npx tsc --noEmit`
Expected: no new errors.
Then visually check `/vault` and `/u/[userId]` in the browser still show the correct tier label/emoji for a known score.

- [ ] **Step 5: Commit**

```bash
git add services/frontend/lib/tiers.ts services/frontend/app/vault/page.tsx services/frontend/app/u/\[userId\]/page.tsx
git commit -m "refactor: extract shared tier definitions used by vault and public profile"
```

---

### Task 10: `@vercel/og` share-card route

**Files:**
- Modify: `services/frontend/package.json`
- Create: `services/frontend/app/api/og/resume-card/route.tsx`

**Interfaces:**
- Consumes: `Tier`/`getTier` (Task 9).
- Produces: `GET /api/og/resume-card?score=&tier=&ratio=9:16|1:1&pros=&jobFit=&subScores=&percentile=&handle=` returning a PNG. Consumed by Task 11 (`ShareCardSheet`).

- [ ] **Step 1: Install `@vercel/og`**

Run: `cd services/frontend && npm install @vercel/og`
Expected: `package.json`/`package-lock.json` updated, install succeeds.

- [ ] **Step 2: Create the route**

```tsx
import { ImageResponse } from '@vercel/og';
import { getTier } from '@/lib/tiers';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const score = Math.max(0, Math.min(100, Number(searchParams.get('score') ?? '0')));
  const ratio = searchParams.get('ratio') === '9:16' ? '9:16' : '1:1';
  const pros = (searchParams.get('pros') ?? '').split('|').filter(Boolean).slice(0, 3);
  const jobFit = searchParams.get('jobFit');
  const percentile = searchParams.get('percentile');
  const handle = searchParams.get('handle');

  const tier = getTier(score);
  const width = 1080;
  const height = ratio === '9:16' ? 1920 : 1080;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: 'white',
          fontFamily: 'sans-serif',
          padding: 64,
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.7, display: 'flex' }}>JOBDOG</div>
        <div style={{ fontSize: 220, fontWeight: 700, display: 'flex' }}>{score}</div>
        <div style={{ fontSize: 56, display: 'flex' }}>
          {tier.emoji} {tier.label}
        </div>
        {handle && <div style={{ fontSize: 32, opacity: 0.8, marginTop: 16, display: 'flex' }}>@{handle}</div>}
        {jobFit && <div style={{ fontSize: 32, marginTop: 24, display: 'flex' }}>{jobFit}</div>}
        {percentile && <div style={{ fontSize: 28, opacity: 0.85, display: 'flex' }}>Top {percentile}% of JobDog users</div>}
        {pros.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 32, gap: 8 }}>
            {pros.map((pro) => (
              <div key={pro} style={{ fontSize: 26, display: 'flex' }}>✓ {pro}</div>
            ))}
          </div>
        )}
      </div>
    ),
    { width, height }
  );
}
```

- [ ] **Step 3: Manually verify the route renders**

Run: `cd services/frontend && npm run dev`, then visit `http://localhost:3000/api/og/resume-card?score=82&tier=GOOD_BOY&ratio=1:1&pros=Strong%20projects|Clean%20formatting&percentile=15&handle=kori`.
Expected: a PNG image renders in the browser with score 82, "GOOD BOY" tier, the two pros, and "Top 15% of JobDog users". Repeat with `ratio=9:16` and confirm the aspect ratio changes.

- [ ] **Step 4: Commit**

```bash
git add services/frontend/package.json services/frontend/package-lock.json services/frontend/app/api/og/resume-card/route.tsx
git commit -m "feat: add @vercel/og share-card image route"
```

---

### Task 11: Pre-share customization sheet

**Files:**
- Create: `services/frontend/components/ShareCardSheet.tsx`
- Modify: `services/frontend/app/vault/page.tsx`
- Modify: `services/frontend/app/u/[userId]/page.tsx`

**Interfaces:**
- Consumes: `/api/og/resume-card` (Task 10), roast result shape with `topDogRank`/`tierName`/`topPros`/`subScores` (Task 7).
- Produces: `<ShareCardSheet score tier pros jobFit subScores percentile handle onClose />` component.

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useMemo, useState } from 'react';

interface ShareCardSheetProps {
  score: number;
  tierLabel: string;
  pros: string[];
  jobFit?: string;
  percentile?: number;
  handle?: string;
  onClose: () => void;
}

export function ShareCardSheet({ score, tierLabel, pros, jobFit, percentile, handle, onClose }: ShareCardSheetProps) {
  const [ratio, setRatio] = useState<'9:16' | '1:1'>('1:1');
  const [showPros, setShowPros] = useState(true);
  const [showJobFit, setShowJobFit] = useState(Boolean(jobFit));
  const [showPercentile, setShowPercentile] = useState(Boolean(percentile));
  const [showHandle, setShowHandle] = useState(Boolean(handle));

  const imageUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('score', String(score));
    params.set('tier', tierLabel);
    params.set('ratio', ratio);
    if (showPros && pros.length > 0) params.set('pros', pros.slice(0, 3).join('|'));
    if (showJobFit && jobFit) params.set('jobFit', jobFit);
    if (showPercentile && percentile != null) params.set('percentile', String(percentile));
    if (showHandle && handle) params.set('handle', handle);
    return `/api/og/resume-card?${params.toString()}`;
  }, [score, tierLabel, ratio, showPros, showJobFit, showPercentile, showHandle, pros, jobFit, percentile, handle]);

  async function handleDownload() {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jobdog-score-${score}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Share your score</h2>
          <button onClick={onClose} className="text-gray-500">Close</button>
        </div>

        <img src={imageUrl} alt="Share card preview" className="mb-4 w-full rounded-lg border" />

        <div className="mb-4 flex gap-2">
          <button
            className={`flex-1 rounded-md border px-3 py-2 text-sm ${ratio === '1:1' ? 'bg-black text-white' : ''}`}
            onClick={() => setRatio('1:1')}
          >
            LinkedIn (1:1)
          </button>
          <button
            className={`flex-1 rounded-md border px-3 py-2 text-sm ${ratio === '9:16' ? 'bg-black text-white' : ''}`}
            onClick={() => setRatio('9:16')}
          >
            Story (9:16)
          </button>
        </div>

        <div className="mb-4 space-y-2 text-sm">
          {pros.length > 0 && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showPros} onChange={(e) => setShowPros(e.target.checked)} />
              Top 3 pros
            </label>
          )}
          {jobFit && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showJobFit} onChange={(e) => setShowJobFit(e.target.checked)} />
              Best job-fit score
            </label>
          )}
          {percentile != null && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showPercentile} onChange={(e) => setShowPercentile(e.target.checked)} />
              Percentile among JobDog users
            </label>
          )}
          {handle && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showHandle} onChange={(e) => setShowHandle(e.target.checked)} />
              Show my handle
            </label>
          )}
        </div>

        <button onClick={handleDownload} className="w-full rounded-md bg-black px-4 py-2 text-white">
          Download image
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire a "Share" button into `vault/page.tsx`**

Add `const [shareOpen, setShareOpen] = useState(false);` and import `{ ShareCardSheet } from '@/components/ShareCardSheet'`. Near wherever the current roast/analysis result is displayed for the selected resume, add a button `<button onClick={() => setShareOpen(true)}>Share</button>`, and render, at the bottom of the component's JSX (sibling to the main return content):

```tsx
{shareOpen && analysisCache[selectedResumeId!] && (
  <ShareCardSheet
    score={analysisCache[selectedResumeId!].overallScore}
    tierLabel={getTier(analysisCache[selectedResumeId!].overallScore).label}
    pros={analysisCache[selectedResumeId!].strengths.slice(0, 3)}
    onClose={() => setShareOpen(false)}
  />
)}
```

- [ ] **Step 3: Wire the same sheet into `u/[userId]/page.tsx`**

Replace the existing clipboard-copy "Share" button's handler with one that opens `ShareCardSheet` instead, passing `profile.topScore.overallScore`, the tier label, and `profile.topScore.strengths.slice(0, 3)` as props, plus `handle={profile.displayName}`.

- [ ] **Step 4: Manually verify in the browser**

Run: `cd services/frontend && npm run dev`. On `/vault`, run an analysis on a resume, click "Share", toggle each checkbox, confirm the preview image updates live, and click "Download image" — confirm a PNG downloads. Repeat on a public `/u/[userId]` page.

- [ ] **Step 5: Commit**

```bash
git add services/frontend/components/ShareCardSheet.tsx services/frontend/app/vault/page.tsx services/frontend/app/u/\[userId\]/page.tsx
git commit -m "feat: pre-share customization sheet for score cards"
```

---

### Task 12: Resume Battle (self-battle) page

**Files:**
- Create: `services/frontend/app/battle/page.tsx`

**Interfaces:**
- Consumes: `api.getResumes()`, `api.roastResume(resumeId, jobId?)` (Task 7's response shape), `getTier` (Task 9).

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { TopBar } from '@/components/TopBar';
import { api } from '@/lib/api';
import { getTier } from '@/lib/tiers';

interface BattleResult {
  resumeId: string;
  label: string;
  topDogRank: number;
  tierName: string;
  subScores: Record<string, number>;
}

export default function BattlePage() {
  const [resumes, setResumes] = useState<Array<{ resumeId: string; label: string }>>([]);
  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');
  const [left, setLeft] = useState<BattleResult | null>(null);
  const [right, setRight] = useState<BattleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getResumes().then((res) => setResumes(res.resumes));
  }, []);

  async function runBattle() {
    if (!leftId || !rightId) return;
    setLoading(true);
    setError(null);
    try {
      const [leftResult, rightResult] = await Promise.all([
        api.roastResume(leftId),
        api.roastResume(rightId),
      ]);
      setLeft({
        resumeId: leftId,
        label: resumes.find((r) => r.resumeId === leftId)?.label ?? 'Resume A',
        topDogRank: leftResult.topDogRank,
        tierName: leftResult.tierName,
        subScores: leftResult.subScores,
      });
      setRight({
        resumeId: rightId,
        label: resumes.find((r) => r.resumeId === rightId)?.label ?? 'Resume B',
        topDogRank: rightResult.topDogRank,
        tierName: rightResult.tierName,
        subScores: rightResult.subScores,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to run battle.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard>
      <TopBar />
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-2xl font-bold">Resume Battle</h1>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <select value={leftId} onChange={(e) => setLeftId(e.target.value)} className="rounded-md border p-2">
            <option value="">Select resume A</option>
            {resumes.map((r) => (
              <option key={r.resumeId} value={r.resumeId}>{r.label}</option>
            ))}
          </select>
          <select value={rightId} onChange={(e) => setRightId(e.target.value)} className="rounded-md border p-2">
            <option value="">Select resume B</option>
            {resumes.map((r) => (
              <option key={r.resumeId} value={r.resumeId}>{r.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={runBattle}
          disabled={!leftId || !rightId || loading}
          className="mb-6 w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Battling…' : 'Battle!'}
        </button>

        {error && <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {left && right && (
          <div className="grid grid-cols-2 gap-4">
            {[left, right].map((side) => {
              const tier = getTier(side.topDogRank);
              const isWinner = left.topDogRank !== right.topDogRank
                && side.topDogRank === Math.max(left.topDogRank, right.topDogRank);
              return (
                <div key={side.resumeId} className={`rounded-lg border p-4 ${isWinner ? 'border-emerald-400 bg-emerald-50' : ''}`}>
                  <div className="mb-1 text-sm text-gray-500">{side.label}</div>
                  <div className="text-3xl font-bold">{side.topDogRank}</div>
                  <div className="mb-3 text-sm">{tier.emoji} {tier.label}</div>
                  {Object.entries(side.subScores).map(([key, value]) => (
                    <div key={key} className="mb-1 flex justify-between text-xs text-gray-600">
                      <span>{key}</span>
                      <span>{Math.round(value * 100) / 100}</span>
                    </div>
                  ))}
                  {isWinner && <div className="mt-2 text-sm font-semibold text-emerald-700">🏆 Winner</div>}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </AuthGuard>
  );
}
```

- [ ] **Step 2: Add a nav link to `/battle`**

Find `services/frontend/components/TopBar.tsx` and add a link to `/battle` alongside the existing nav links (e.g. next to the link to `/vault`), following that file's existing link styling.

- [ ] **Step 3: Manually verify in the browser**

Run: `cd services/frontend && npm run dev`. Visit `/battle` with a user that has at least two parsed resumes, select both, click "Battle!", confirm both cards render with scores, sub-scores, and the higher-scoring one is marked "Winner". Confirm selecting the same resume twice still works (ties show no winner badge).

- [ ] **Step 4: Commit**

```bash
git add services/frontend/app/battle/page.tsx services/frontend/components/TopBar.tsx
git commit -m "feat: add Resume Battle self-battle comparison page"
```

---

## Self-Review Notes

- **Spec coverage:** deterministic hybrid scoring + Redis cache (Task 6), delete cascade fix (Tasks 4-5), share image generation (Task 10), pre-share customization toggles (Task 11), Resume Battle self-battle (Task 12) — all covered. Resume Battle Phase B (social leaderboard) is explicitly out of scope for this plan per the spec's phasing — it depends on `benchmark` package percentile data and is deferred to a follow-up plan once this one ships.
- **Type consistency:** `RoastGradeCacheEntry` (Task 2) is the single record used by both the Redis cache and internally by `RoastService` (Task 6) — no renamed duplicate. `getTier`/`TIERS` (Task 9) is the single source used by Tasks 10, 11, 12 and both existing pages.
- **Out of scope for this plan:** AWS migration, Kafka/Databricks pipeline, job card UI refactor, New Grad ingestion focus, Resume Battle Phase B — all deferred to their own sub-project plans per the design spec.
