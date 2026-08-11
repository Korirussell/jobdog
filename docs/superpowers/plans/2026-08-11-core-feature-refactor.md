# Core Feature Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per explicit user preference this session, keep review lightweight — implementer self-review plus one pass is sufficient; the full per-task-reviewer + fix-loop + final-whole-branch-review cadence is not required unless a task looks genuinely risky.

**Goal:** Fix confirmed bugs in the apply flow and application tracker, improve scraper reliability/source accuracy, and refresh job browsing around New Grad SWE roles with real tags (company tier, experience level, Ghost Score).

**Architecture:** No new services. Backend changes are additive (new columns via Flyway migrations, new/adjusted service methods). Scraper changes touch `services/scraper-worker` (Go) for reliability and classification. Frontend changes are confined to the apply flow, application tracker, and job list row.

**Tech Stack:** Java 21 / Spring Boot 3.3.5 / Spring Data JPA / Flyway (backend-api); Go 1.25 / stdlib `encoding/json` (scraper-worker, no new dependencies); Next.js 15 / TypeScript (frontend).

## Global Constraints

- Backend module root: `services/backend-api`. Frontend: `services/frontend`. Scraper: `services/scraper-worker`.
- Next Flyway migration version: **V13** (last is V12__roast_history_subscores.sql). Each migration in this plan touches one logical unit (applications, then jobs) — use V13 and V14 respectively.
- No local Maven/JDK/Go toolchain — backend commands run via the Maven Docker container (see Task 1 for the exact invocation); Go commands run via a `golang` Docker container the same way (established in Task 7).
- `JobCard.tsx` is dead code (marked `// Deprecated` in its own header) — do not modify it. All job-list UI work targets `JobListRow.tsx`, the live component.
- `BenchmarkJobEntity.category` (FAANG/UNICORN tiers) is unrelated to real scraped jobs — it's only used by the separate synthetic benchmark-jobs feature. Company tier for real job cards needs its own lookup, not a reuse of that field.
- `workday_scraper.go` (not `workday_adapter.go`) is the one actually wired into `main.go` — all Workday work in this plan targets that file. `workday_adapter.go` is unused/dead code, out of scope.
- `applications.status` is a plain `VARCHAR(32)` with no DB-level CHECK constraint — removing Java enum values is a pure code change, no migration needed for that part.

---

## File Structure

**Backend (`services/backend-api/src/main/java/dev/jobdog/backend/`):**
- `application/ApplicationResponse.java` — **modify**. No field rename needed here (frontend adapts to match `message`).
- `application/ApplicationStatus.java` — **modify**. Remove `RUNNING`, `ORPHANED`, `KILLED`.
- `application/ApplicationEntity.java` — **modify**. Add `deadline`, `notes` fields.
- `application/ApplicationRepository.java` — **modify**. Add `@EntityGraph`-annotated batch-fetch method.
- `application/ApplicationService.java` — **modify**. Fix `listApplications` N+1; extend `updateStatus`-adjacent logic for deadline/notes.
- `application/UpdateApplicationRequest.java` — **new**. Request DTO for the expanded PATCH endpoint.
- `application/UserApplicationController.java` — **modify**. PATCH endpoint accepts optional deadline/notes.
- `benchmark/ApplicationScoreRepository.java` — **modify**. Add batch-fetch-by-application-ids method.
- `job/CompanyTier.java` — **new**. Small hardcoded company→tier lookup (mirrors `BenchmarkService`'s seed pattern).
- `job/JobService.java` — **modify**. Attach `companyTier`, `ghostScore`, `experienceLevel` to `JobSummaryResponse`; honest date semantics untouched (frontend-only fix).
- `job/JobSummaryResponse.java` (or wherever that record lives — confirmed inline in `JobService.java` usage; locate exact file in Task 6) — **modify**.
- `job/JobEntity.java` — **modify**. Add `experienceLevel` field.
- `ghost/GhostReportRepository.java` — **modify**. Add batched company-score query.
- `src/main/resources/db/migration/V13__applications_deadline_notes.sql` — **new**.
- `src/main/resources/db/migration/V14__jobs_experience_level.sql` — **new**.

**Backend tests (`services/backend-api/src/test/java/dev/jobdog/backend/`):**
- `application/ApplicationServiceTest.java` — **new**.
- `job/CompanyTierTest.java` — **new**.

**Scraper (`services/scraper-worker/`):**
- `scraper/greenhouse_scraper.go` — **modify**. Wrap fetch in `RetryWithBackoff`.
- `scraper/github_scraper.go` — **modify**. Wrap README fetch in `RetryWithBackoff`.
- `scraper/workday_scraper.go` — **modify**. Fix silent date-parse failure.
- `scraper/experience_level.go` — **new**. Title/description keyword classifier (intern/new-grad/senior).
- `config/config.go` — **modify**. Load company lists from an external JSON file if present, falling back to the existing embedded defaults.
- `config/sources.json` — **new**. Externalized company list (starts as an exact export of the current hardcoded lists).
- `repository/job_repository.go` — **modify**. Add `experience_level` write path; add `PurgeOldClosedJobs`.
- `main.go` — **modify**. Wire experience-level classification into the upsert path; add purge call to the 12h cron.

**Scraper tests (`services/scraper-worker/scraper/`):**
- `experience_level_test.go` — **new**.
- `retry_test.go` — **new** (if not already covered — confirm at Task 7 time).

**Frontend (`services/frontend/`):**
- `lib/api.ts` — **modify**. Fix `createApplication`'s response type (`message` not `earlyApplicantMessage`); update `updateApplicationStatus` for deadline/notes.
- `components/ApplyModal.tsx` — **modify**. Read `res.message`.
- `app/jobs/[jobId]/JobDetailApplyButton.tsx` — **new**. Client component wrapping `ApplyModal` for the server-component detail page.
- `app/jobs/[jobId]/page.tsx` — **modify**. Use the new client wrapper instead of a bare anchor.
- `components/ApplicationTracker.tsx` — **modify**. Deadline/notes read/write via API instead of `localStorage`.
- `components/JobListRow.tsx` — **modify**. Honest date label, company tier / New Grad / Ghost Score tags, fixed memo comparator.

---

### Task 1: Fix apply-flow field mismatch + wire tracked Apply into the job detail page

**Files:**
- Modify: `services/frontend/lib/api.ts`
- Modify: `services/frontend/components/ApplyModal.tsx`
- Create: `services/frontend/app/jobs/[jobId]/JobDetailApplyButton.tsx`
- Modify: `services/frontend/app/jobs/[jobId]/page.tsx`

**Interfaces:**
- Produces: `<JobDetailApplyButton jobId company jobTitle applyUrl />` (default export, client component), reusable anywhere a job's detail is known.

- [ ] **Step 1: Fix the response type in `api.ts`**

In `services/frontend/lib/api.ts`'s `createApplication` (around line 254-269), change the return type's `earlyApplicantMessage: string | null;` to `message: string | null;`:

```ts
async createApplication(jobId: string, resumeId: string) {
  return this.request<{
    applicationId: string;
    matchScore: number;
    benchmarkState: string;
    percentile: number | null;
    applicantCount: number;
    message: string | null;
  }>(`/api/v1/jobs/${jobId}/applications`, {
    method: 'POST',
    body: JSON.stringify({ resumeId }),
  });
}
```

- [ ] **Step 2: Fix `ApplyModal.tsx` to read the corrected field**

Find the `result` state shape and the line reading `res.earlyApplicantMessage` (around line 74-79 and 104-109 per current file) and change both the state field name and the read site from `earlyApplicantMessage` to `message`. The state type becomes:

```ts
const [result, setResult] = useState<{
  matchScore: number;
  percentile: number | null;
  benchmarkState: string;
  message: string | null;
} | null>(null);
```

And in `handleSubmit`:

```ts
const res = await api.createApplication(jobId, selectedResumeId);
setResult({
  matchScore: res.matchScore,
  percentile: res.percentile ?? null,
  benchmarkState: res.benchmarkState,
  message: res.message ?? null,
});
```

Update the render logic that currently checks `result.earlyApplicantMessage` to check `result.message` instead — keep the existing "🚀 Early applicant!" banner condition and copy exactly as-is, just reading the corrected field.

- [ ] **Step 3: Create the job-detail-page Apply wrapper**

`app/jobs/[jobId]/page.tsx` is a Next.js **server component** — it cannot hold the `useState` that `ApplyModal` needs, so create a small client component to bridge:

```tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ApplyModal from '@/components/ApplyModal';

interface JobDetailApplyButtonProps {
  jobId: string;
  jobTitle: string;
  company: string;
  applyUrl: string;
}

export default function JobDetailApplyButton({ jobId, jobTitle, company, applyUrl }: JobDetailApplyButtonProps) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <a
        href={applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full border-2 border-black bg-primary px-4 py-2.5 font-mono text-sm font-bold uppercase text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      >
        Apply ↗
      </a>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="block w-full border-2 border-black bg-primary px-4 py-2.5 font-mono text-sm font-bold uppercase text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      >
        Apply ↗
      </button>
      {open && (
        <ApplyModal
          jobId={jobId}
          jobTitle={jobTitle}
          company={company}
          applyUrl={applyUrl}
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      )}
    </>
  );
}
```

Confirm `useAuth`'s exact import path/hook name against `services/frontend/contexts/AuthContext.tsx` before finalizing this file — if the hook name or export style differs from `useAuth`/`isAuthenticated`, adjust to match the actual contract (check how `HomePageClient.tsx` imports it, since that file uses the same pattern correctly).

Anonymous users get a direct (untracked) link — matches the existing anonymous behavior on the homepage (`JobListRow`'s apply button doesn't render for unauthenticated users at all; here we keep a direct link so anonymous visitors landing on a shared detail-page link can still act, just without tracking, which requires login anyway).

- [ ] **Step 4: Wire it into `page.tsx`**

Replace the existing bare `<a href={job.applyUrl} ...>Apply ↗</a>` block (lines ~101-108) with:

```tsx
<JobDetailApplyButton
  jobId={job.jobId}
  jobTitle={job.title}
  company={job.company}
  applyUrl={job.applyUrl}
/>
```

Add the import `import JobDetailApplyButton from './JobDetailApplyButton';` at the top of `page.tsx`. Verify the field names (`job.jobId`, `job.title`, `job.company`, `job.applyUrl`) exactly match what `fetchJob` from `lib/public-jobs` actually returns — read that function's return type before finalizing if there's any doubt.

- [ ] **Step 5: Type-check**

Run: `cd services/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Start the stack (`docker-compose up -d` from repo root, or point at the AWS instance if easier), log in, and: (a) apply from the homepage listing — confirm tracking still works and any early-applicant message now renders when applicable; (b) visit a job's `/jobs/[jobId]` detail page directly and apply from there — confirm a new `applications` row is created (check via `GET /api/v1/applications` or the tracker UI) where previously nothing was tracked.

- [ ] **Step 7: Commit**

```bash
git add services/frontend/lib/api.ts services/frontend/components/ApplyModal.tsx services/frontend/app/jobs/\[jobId\]/JobDetailApplyButton.tsx services/frontend/app/jobs/\[jobId\]/page.tsx
git commit -m "fix: apply-flow message field mismatch and untracked detail-page apply button"
```

---

### Task 2: Fix Application tracker N+1 query

**Files:**
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/application/ApplicationRepository.java`
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/benchmark/ApplicationScoreRepository.java`
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/application/ApplicationService.java`
- Test: `services/backend-api/src/test/java/dev/jobdog/backend/application/ApplicationServiceTest.java`

**Interfaces:**
- Produces: `ApplicationRepository.findByUser_IdOrderByAppliedAtDesc` gains eager `job`/`resume` fetch (same method name/signature, callers unaffected). `ApplicationScoreRepository.findByApplication_IdIn(Collection<UUID>) -> List<ApplicationScoreEntity>` (new).

- [ ] **Step 1: Write the failing test**

```java
package dev.jobdog.backend.application;

import dev.jobdog.backend.benchmark.ApplicationScoreEntity;
import dev.jobdog.backend.benchmark.ApplicationScoreRepository;
import dev.jobdog.backend.job.JobEntity;
import dev.jobdog.backend.job.JobRepository;
import dev.jobdog.backend.job.JobRequirementProfileRepository;
import dev.jobdog.backend.resume.ResumeEntity;
import dev.jobdog.backend.resume.ResumeProfileRepository;
import dev.jobdog.backend.resume.ResumeRepository;
import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApplicationServiceTest {

    @Mock private ApplicationRepository applicationRepository;
    @Mock private ApplicationScoreRepository applicationScoreRepository;
    @Mock private UserRepository userRepository;
    @Mock private ResumeRepository resumeRepository;
    @Mock private ResumeProfileRepository resumeProfileRepository;
    @Mock private JobRepository jobRepository;
    @Mock private JobRequirementProfileRepository jobRequirementProfileRepository;

    @InjectMocks
    private ApplicationService applicationService;

    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
    }

    @Test
    void listApplications_batchFetchesScoresInsteadOfPerRow() {
        UserEntity user = new UserEntity();
        JobEntity job1 = new JobEntity();
        job1.setTitle("SWE Intern");
        job1.setCompany("Acme");
        ResumeEntity resume1 = new ResumeEntity();
        resume1.setLabel("default");

        ApplicationEntity app1 = new ApplicationEntity();
        app1.setUser(user);
        app1.setJob(job1);
        app1.setResume(resume1);
        app1.setStatus(ApplicationStatus.APPLIED);
        app1.setAppliedAt(Instant.now());

        ApplicationEntity app2 = new ApplicationEntity();
        app2.setUser(user);
        app2.setJob(job1);
        app2.setResume(resume1);
        app2.setStatus(ApplicationStatus.SCORED);
        app2.setAppliedAt(Instant.now());

        when(applicationRepository.findByUser_IdOrderByAppliedAtDesc(userId)).thenReturn(List.of(app1, app2));
        when(applicationScoreRepository.findByApplication_IdIn(anyList())).thenReturn(List.of());

        applicationService.listApplications(userId);

        // Exactly one batched score lookup, never a per-application lookup.
        verify(applicationScoreRepository, times(1)).findByApplication_IdIn(anyList());
        verify(applicationScoreRepository, never()).findByApplication_Id(any());
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run (via the Maven Docker container, from `services/backend-api`):
```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "<repo-path>/services/backend-api:/app" -v jobdog-maven-repo:/root/.m2 -w /app maven:3.9.9-eclipse-temurin-21 mvn -q test -Dtest=ApplicationServiceTest
```
Expected: FAIL — `findByApplication_IdIn` doesn't exist yet, and/or the per-row `findByApplication_Id` is still called.

- [ ] **Step 3: Add the batch score-fetch method**

In `services/backend-api/src/main/java/dev/jobdog/backend/benchmark/ApplicationScoreRepository.java`, add:

```java
List<ApplicationScoreEntity> findByApplication_IdIn(java.util.Collection<UUID> applicationIds);
```

- [ ] **Step 4: Add `@EntityGraph` to the tracker's list query**

In `ApplicationRepository.java`, add the import `org.springframework.data.jpa.repository.EntityGraph` and annotate the existing method:

```java
@EntityGraph(attributePaths = {"job", "resume"})
List<ApplicationEntity> findByUser_IdOrderByAppliedAtDesc(UUID userId);
```

(Safe to eager-fetch here — both `job` and `resume` are `@ManyToOne`, no collection association involved, so no cartesian-product risk.)

- [ ] **Step 5: Rewrite `listApplications` to batch the score lookup**

In `ApplicationService.java`, replace the per-row `applicationScoreRepository.findByApplication_Id(app.getId())` call inside the mapping loop with a single upfront batched fetch:

```java
public List<ApplicationListItem> listApplications(UUID userId) {
    List<ApplicationEntity> applications = applicationRepository.findByUser_IdOrderByAppliedAtDesc(userId);

    Map<UUID, ApplicationScoreEntity> scoresByApplicationId = applicationScoreRepository
            .findByApplication_IdIn(applications.stream().map(ApplicationEntity::getId).toList())
            .stream()
            .collect(Collectors.toMap(s -> s.getApplication().getId(), s -> s));

    return applications.stream()
            .map(app -> toListItem(app, scoresByApplicationId.get(app.getId())))
            .toList();
}
```

Extract the existing per-application mapping body (job/resume field reads, percentile/matchScore defaults) into a private `toListItem(ApplicationEntity app, ApplicationScoreEntity score)` method — keep its logic identical to what's there today, just parameterized on the pre-fetched `score` instead of calling the repository inline. Add `java.util.Map` and `java.util.stream.Collectors` imports if not already present.

- [ ] **Step 6: Run the test to verify it passes**

Run: `mvn -q test -Dtest=ApplicationServiceTest`
Expected: BUILD SUCCESS.

- [ ] **Step 7: Run the full backend suite**

Run: `mvn -q test`
Expected: BUILD SUCCESS, no regressions.

- [ ] **Step 8: Commit**

```bash
git add services/backend-api/src/main/java/dev/jobdog/backend/application/ApplicationRepository.java services/backend-api/src/main/java/dev/jobdog/backend/benchmark/ApplicationScoreRepository.java services/backend-api/src/main/java/dev/jobdog/backend/application/ApplicationService.java services/backend-api/src/test/java/dev/jobdog/backend/application/ApplicationServiceTest.java
git commit -m "fix: eliminate N+1 query in application tracker listing"
```

---

### Task 3: Remove dead ApplicationStatus enum values

**Files:**
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/application/ApplicationStatus.java`

**Interfaces:**
- Consumes: none new. Confirmed via repo-wide grep (already done during spec research) that `RUNNING`, `ORPHANED`, `KILLED` are referenced nowhere outside this enum's own declaration.

- [ ] **Step 1: Remove the three dead values**

Edit `ApplicationStatus.java` to keep only: `APPLIED, SCORED, INTERVIEWING, OFFER, REJECTED, WITHDRAWN, FAILED`.

- [ ] **Step 2: Grep to double-check nothing references the removed values before compiling**

Run: `grep -rn "RUNNING\|ORPHANED\|KILLED" services/backend-api/src/main/java/dev/jobdog/backend/application/ services/frontend/`
Expected: no matches referencing `ApplicationStatus.RUNNING`/`ORPHANED`/`KILLED` specifically (if any unrelated match turns up — e.g. a different domain's own enum — leave it alone, this task only concerns `ApplicationStatus`).

- [ ] **Step 3: Compile**

Run: `mvn -q -DskipTests compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add services/backend-api/src/main/java/dev/jobdog/backend/application/ApplicationStatus.java
git commit -m "cleanup: remove unused ApplicationStatus enum values"
```

---

### Task 4: Application deadline/notes — backend persistence, off localStorage

**Files:**
- Create: `services/backend-api/src/main/resources/db/migration/V13__applications_deadline_notes.sql`
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/application/ApplicationEntity.java`
- Create: `services/backend-api/src/main/java/dev/jobdog/backend/application/UpdateApplicationRequest.java`
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/application/ApplicationService.java`
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/application/UserApplicationController.java`
- Modify: `services/frontend/lib/api.ts`
- Modify: `services/frontend/components/ApplicationTracker.tsx`

**Interfaces:**
- Produces: `PATCH /api/v1/applications/{id}` (new, alongside the existing status-only PATCH) accepting `{ status?: string, deadline?: string | null, notes?: string | null }`, all fields optional — only provided fields are updated.

- [ ] **Step 1: Migration**

```sql
ALTER TABLE applications
    ADD COLUMN deadline DATE,
    ADD COLUMN notes TEXT;
```

- [ ] **Step 2: Add fields to the entity**

In `ApplicationEntity.java`, add:

```java
@Column
private java.time.LocalDate deadline;

@Column(columnDefinition = "TEXT")
private String notes;

public java.time.LocalDate getDeadline() { return deadline; }
public void setDeadline(java.time.LocalDate deadline) { this.deadline = deadline; }
public String getNotes() { return notes; }
public void setNotes(String notes) { this.notes = notes; }
```

- [ ] **Step 3: Create the request DTO**

```java
package dev.jobdog.backend.application;

import java.time.LocalDate;

public record UpdateApplicationRequest(String status, LocalDate deadline, String notes, boolean clearDeadline, boolean clearNotes) {
}
```

(`clearDeadline`/`clearNotes` let the client explicitly null out a previously-set value — a missing field in the JSON body vs. an explicit "clear" are different intents that a plain nullable field can't distinguish from Jackson deserialization alone.)

- [ ] **Step 4: Add the service method**

In `ApplicationService.java`, add a new method alongside the existing `updateStatus`:

```java
@Transactional
public void updateApplicationDetails(UUID applicationId, UUID userId, UpdateApplicationRequest request) {
    ApplicationEntity application = applicationRepository.findById(applicationId)
            .orElseThrow(() -> new IllegalArgumentException("Application not found"));
    if (!application.getUser().getId().equals(userId)) {
        throw new IllegalArgumentException("Application does not belong to user");
    }

    if (request.status() != null && !request.status().isBlank()) {
        application.setStatus(ApplicationStatus.valueOf(request.status().toUpperCase()));
    }
    if (request.clearDeadline()) {
        application.setDeadline(null);
    } else if (request.deadline() != null) {
        application.setDeadline(request.deadline());
    }
    if (request.clearNotes()) {
        application.setNotes(null);
    } else if (request.notes() != null) {
        application.setNotes(request.notes());
    }
}
```

- [ ] **Step 5: Add the controller endpoint**

In `UserApplicationController.java`, add (keep the existing status-only PATCH endpoint as-is for backward compatibility, or fold it into this — check the existing endpoint's exact path/method signature first; if it's already `PATCH /{applicationId}/status`, add this as a sibling `PATCH /{applicationId}` rather than replacing it, so nothing else that calls the status-only endpoint breaks):

```java
@PatchMapping("/{applicationId}")
public ResponseEntity<Void> updateApplication(@PathVariable UUID applicationId, @RequestBody UpdateApplicationRequest request) {
    var userId = currentUser.require().userId();
    applicationService.updateApplicationDetails(applicationId, userId, request);
    return ResponseEntity.noContent().build();
}
```

- [ ] **Step 6: Update `lib/api.ts`**

Add a new method alongside the existing `updateApplicationStatus`:

```ts
async updateApplicationDetails(applicationId: string, updates: { status?: string; deadline?: string | null; notes?: string | null }) {
  const body: Record<string, unknown> = {};
  if (updates.status !== undefined) body.status = updates.status;
  if (updates.deadline !== undefined) {
    if (updates.deadline === null) body.clearDeadline = true;
    else body.deadline = updates.deadline;
  }
  if (updates.notes !== undefined) {
    if (updates.notes === null) body.clearNotes = true;
    else body.notes = updates.notes;
  }
  return this.request<void>(`/api/v1/applications/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
```

Also add `deadline: string | null;` and `notes: string | null;` to the `getApplications()` response type (find its declaration in `api.ts` and extend the array item shape) — the backend's `ApplicationListItem` (used by `listApplications`) needs the same fields added; confirm that record's exact current shape in `ApplicationService.java` and add `deadline`/`notes` fields to it and its construction in `toListItem` (from Task 2) so the tracker can read persisted values.

- [ ] **Step 7: Update `ApplicationTracker.tsx`**

Remove the `localStorage` read/write (`jobdog_app_meta` key) entirely. Replace deadline/notes state with values read directly from each `application.deadline`/`application.notes` (now present on the API response per Step 6), and on edit, call `api.updateApplicationDetails(applicationId, { deadline: newValue })` / `{ notes: newValue }` instead of writing to `localStorage`. Keep the existing input UI/debounce behavior — only the persistence target changes.

- [ ] **Step 8: Type-check and compile**

Run backend: `mvn -q -DskipTests compile`
Run frontend: `cd services/frontend && npx tsc --noEmit`
Expected: both clean.

- [ ] **Step 9: Run full backend suite**

Run: `mvn -q test`
Expected: BUILD SUCCESS.

- [ ] **Step 10: Commit**

```bash
git add services/backend-api/src/main/resources/db/migration/V13__applications_deadline_notes.sql services/backend-api/src/main/java/dev/jobdog/backend/application/ services/frontend/lib/api.ts services/frontend/components/ApplicationTracker.tsx
git commit -m "feat: persist application deadline/notes server-side instead of localStorage"
```

---

### Task 5: Job experience-level classification (New Grad focus)

**Files:**
- Create: `services/backend-api/src/main/resources/db/migration/V14__jobs_experience_level.sql`
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/job/JobEntity.java`
- Create: `services/scraper-worker/scraper/experience_level.go`
- Test: `services/scraper-worker/scraper/experience_level_test.go`
- Modify: `services/scraper-worker/repository/job_repository.go`
- Modify: `services/scraper-worker/main.go`

**Interfaces:**
- Produces: `ClassifyExperienceLevel(title, description string) string` returning one of `"INTERN"`, `"NEW_GRAD"`, `"SENIOR"`, `"UNKNOWN"` — Go function, consumed by the upsert path.
- DB column `jobs.experience_level VARCHAR(16)`, nullable (existing rows backfill as `NULL`/`UNKNOWN` until re-scraped).

- [ ] **Step 1: Migration**

```sql
ALTER TABLE jobs
    ADD COLUMN experience_level VARCHAR(16);

CREATE INDEX idx_jobs_experience_level ON jobs(experience_level);
```

- [ ] **Step 2: Add the field to `JobEntity`**

```java
@Column(length = 16)
private String experienceLevel;

public String getExperienceLevel() { return experienceLevel; }
public void setExperienceLevel(String experienceLevel) { this.experienceLevel = experienceLevel; }
```

(No JobStatus-style enum on the Java side for this plan's scope — a plain string column keeps this additive and avoids a stricter contract than the Go classifier currently justifies; revisit if a later phase needs it.)

- [ ] **Step 3: Write the failing test for the classifier**

```go
package scraper

import "testing"

func TestClassifyExperienceLevel(t *testing.T) {
	cases := []struct {
		name        string
		title       string
		description string
		want        string
	}{
		{"clear intern title", "Software Engineer Intern", "", "INTERN"},
		{"co-op title", "Backend Co-op", "", "INTERN"},
		{"clear new grad title", "Software Engineer I - New Grad", "", "NEW_GRAD"},
		{"entry level phrasing", "Junior Software Engineer", "0-1 years of experience", "NEW_GRAD"},
		{"senior title", "Senior Software Engineer", "", "SENIOR"},
		{"staff title excludes new grad", "Staff Engineer", "", "SENIOR"},
		{"years requirement signals senior", "Software Engineer", "5+ years of experience required", "SENIOR"},
		{"no signal either way", "Software Engineer", "Join our team building great products.", "UNKNOWN"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ClassifyExperienceLevel(tc.title, tc.description)
			if got != tc.want {
				t.Errorf("ClassifyExperienceLevel(%q, %q) = %q, want %q", tc.title, tc.description, got, tc.want)
			}
		})
	}
}
```

- [ ] **Step 4: Run the test to verify it fails**

Run (via a Go Docker container, mirroring the Maven-container pattern established for backend-api — from `services/scraper-worker`):
```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "<repo-path>/services/scraper-worker:/app" -w /app golang:1.25 go test ./scraper/... -run TestClassifyExperienceLevel -v
```
Expected: FAIL — `ClassifyExperienceLevel` doesn't exist yet.

- [ ] **Step 5: Implement the classifier**

```go
package scraper

import "strings"

// ClassifyExperienceLevel returns "INTERN", "NEW_GRAD", "SENIOR", or "UNKNOWN"
// based on keyword signals in the job title and description. Title signals
// take priority over description signals since titles are more reliable.
func ClassifyExperienceLevel(title, description string) string {
	t := strings.ToLower(title)
	d := strings.ToLower(description)

	internTitleSignals := []string{"intern", "co-op", "coop", "internship"}
	for _, s := range internTitleSignals {
		if strings.Contains(t, s) {
			return "INTERN"
		}
	}

	seniorTitleSignals := []string{"senior", "sr.", "staff", "principal", "lead engineer", "director", "manager"}
	for _, s := range seniorTitleSignals {
		if strings.Contains(t, s) {
			return "SENIOR"
		}
	}

	newGradTitleSignals := []string{"new grad", "entry level", "entry-level", "junior", "university grad", "recent graduate"}
	for _, s := range newGradTitleSignals {
		if strings.Contains(t, s) {
			return "NEW_GRAD"
		}
	}

	// No title signal — fall back to description-level experience-year hints.
	if strings.Contains(d, "5+ years") || strings.Contains(d, "5+ years of experience") ||
		strings.Contains(d, "7+ years") || strings.Contains(d, "10+ years") {
		return "SENIOR"
	}
	if strings.Contains(d, "0-1 year") || strings.Contains(d, "0-2 year") || strings.Contains(d, "no prior experience") {
		return "NEW_GRAD"
	}

	return "UNKNOWN"
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `go test ./scraper/... -run TestClassifyExperienceLevel -v`
Expected: PASS, all 8 cases.

- [ ] **Step 7: Wire it into the upsert path**

In `services/scraper-worker/repository/job_repository.go`, `UpsertJob` currently builds its `INSERT ... ON CONFLICT` statement from a `Job` struct's fields. Add `ExperienceLevel string` to that struct (find its definition — likely in a shared `models`/`scraper` package referenced by `job_repository.go`; confirm exact location before editing), add `experience_level` to the column list and the `ON CONFLICT DO UPDATE SET` clause (`experience_level = EXCLUDED.experience_level` — always overwrite, unlike `posted_at`, since re-classification should reflect the latest title/description if either changed).

In each scraper (`greenhouse_scraper.go`, `lever_scraper.go`, `github_scraper.go`, `workday_scraper.go`) or — more centrally — wherever `main.go` calls the upsert after a scraper returns a `Job`, call `job.ExperienceLevel = ClassifyExperienceLevel(job.Title, job.DescriptionText)` before the upsert. Prefer doing this in one place (immediately before each `repo.UpsertJob(...)` call site in `main.go`, or inside `UpsertJob` itself if it already has access to title/description) rather than duplicating the call across four scraper files — confirm which is cleaner given the actual call-site structure in `main.go`.

- [ ] **Step 8: Run the full Go test suite**

Run: `go test ./... -v`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add services/backend-api/src/main/resources/db/migration/V14__jobs_experience_level.sql services/backend-api/src/main/java/dev/jobdog/backend/job/JobEntity.java services/scraper-worker/scraper/experience_level.go services/scraper-worker/scraper/experience_level_test.go services/scraper-worker/repository/job_repository.go services/scraper-worker/main.go
git commit -m "feat: classify job experience level (intern/new-grad/senior) at scrape time"
```

---

### Task 6: Company tier + Ghost Score surfaced on job cards (backend)

**Files:**
- Create: `services/backend-api/src/main/java/dev/jobdog/backend/job/CompanyTier.java`
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/ghost/GhostReportRepository.java` (or wherever ghost score computation lives — confirm exact file/method name first, per the `GhostScoreController`/ghost package structure)
- Modify: `services/backend-api/src/main/java/dev/jobdog/backend/job/JobService.java`
- Test: `services/backend-api/src/test/java/dev/jobdog/backend/job/CompanyTierTest.java`

**Interfaces:**
- Produces: `CompanyTier.lookup(String company) -> String` (returns `"FAANG"`, `"UNICORN"`, `"STARTUP"`, or `null` if unknown — static utility, no DB).
- `JobSummaryResponse` (wherever that record is defined — confirmed used by `JobService.listActiveJobs`, locate its exact file before editing) gains `companyTier`, `ghostScore` fields alongside the existing `matchPercentage`.

- [ ] **Step 1: Write the failing test**

```java
package dev.jobdog.backend.job;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class CompanyTierTest {

    @Test
    void lookup_matchesKnownFaangCompaniesCaseInsensitively() {
        assertEquals("FAANG", CompanyTier.lookup("Google"));
        assertEquals("FAANG", CompanyTier.lookup("meta"));
        assertEquals("FAANG", CompanyTier.lookup("AMAZON"));
    }

    @Test
    void lookup_matchesKnownUnicorns() {
        assertEquals("UNICORN", CompanyTier.lookup("Stripe"));
        assertEquals("UNICORN", CompanyTier.lookup("Databricks"));
    }

    @Test
    void lookup_returnsNullForUnknownCompany() {
        assertNull(CompanyTier.lookup("Some Random Startup LLC"));
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `mvn -q test -Dtest=CompanyTierTest`
Expected: FAIL — `CompanyTier` doesn't exist yet.

- [ ] **Step 3: Implement the lookup**

```java
package dev.jobdog.backend.job;

import java.util.Map;
import java.util.Set;

/**
 * Curated company-tier lookup for job card tagging. Deliberately a small hardcoded
 * list (mirrors the pattern already used for BenchmarkService's seed data) rather
 * than a database table — the tier a company belongs to is an editorial judgment
 * call, not scraped data, and doesn't need migration/admin tooling at this scale.
 */
public final class CompanyTier {

    private static final Set<String> FAANG = Set.of(
            "google", "meta", "facebook", "amazon", "apple", "netflix", "microsoft"
    );

    private static final Set<String> UNICORN = Set.of(
            "stripe", "databricks", "cloudflare", "openai", "anthropic", "airbnb",
            "doordash", "instacart", "figma", "notion", "canva", "discord",
            "coinbase", "robinhood", "plaid", "brex", "ramp", "scale ai"
    );

    private CompanyTier() {
    }

    public static String lookup(String company) {
        if (company == null || company.isBlank()) {
            return null;
        }
        String normalized = company.trim().toLowerCase();
        if (FAANG.contains(normalized)) {
            return "FAANG";
        }
        if (UNICORN.contains(normalized)) {
            return "UNICORN";
        }
        return null;
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `mvn -q test -Dtest=CompanyTierTest`
Expected: BUILD SUCCESS.

- [ ] **Step 5: Add a batched Ghost Score lookup**

Read `services/backend-api/src/main/java/dev/jobdog/backend/ghost/` in full first (the controller/service that backs `GET /api/v1/ghost-score?company=X`) to find the exact existing per-company computation method (referred to in research as `computeGhostScore`). Add a batched variant that computes ghost scores for a set of distinct company names in one pass — e.g. a native query grouping `ghost_reports`/`jobs` by company (mirroring the existing single-company query's structure, just grouped), returning `Map<String, Double>`. Name and place this method consistently with the existing ghost package's conventions (confirm the exact class name during implementation rather than guessing).

- [ ] **Step 6: Attach `companyTier` and `ghostScore` to job summaries**

In `JobService.listActiveJobs`, after building the list of jobs to return, compute the distinct set of company names in that page's results, call the new batched Ghost Score lookup once for that set, and build a `companyTier` value per job via `CompanyTier.lookup(job.getCompany())`. Add both fields to whatever record/class constitutes `JobSummaryResponse` (locate its exact definition — confirmed to be built inline or via a nearby record in `JobService.java`; the field list per research is `id, title, company, location, employmentType, postedAt, scrapedAt, status.name(), sourceUrl, matchPercentage`) — add `companyTier` (nullable `String`) and `ghostScore` (nullable `Double`) alongside those.

Also add `experienceLevel` (from Task 5's new `JobEntity` field) to this same response — it belongs in the same "extra job-card metadata" pass.

- [ ] **Step 7: Run the full backend suite**

Run: `mvn -q test`
Expected: BUILD SUCCESS.

- [ ] **Step 8: Commit**

```bash
git add services/backend-api/src/main/java/dev/jobdog/backend/job/CompanyTier.java services/backend-api/src/main/java/dev/jobdog/backend/ghost/ services/backend-api/src/main/java/dev/jobdog/backend/job/JobService.java services/backend-api/src/test/java/dev/jobdog/backend/job/CompanyTierTest.java
git commit -m "feat: surface company tier, Ghost Score, and experience level on job listings"
```

---

### Task 7: Scraper retry logic (Greenhouse + GitHub)

**Files:**
- Modify: `services/scraper-worker/scraper/greenhouse_scraper.go`
- Modify: `services/scraper-worker/scraper/github_scraper.go`

**Interfaces:**
- Consumes: existing `RetryWithBackoff(ctx context.Context, maxRetries int, operation string, fn func() error) error` from `scraper/retry.go` (already used by `workday_scraper.go` — same call pattern).

- [ ] **Step 1: Wrap the Greenhouse fetch**

In `greenhouse_scraper.go`'s `ScrapeCompany`, find the single-shot HTTP GET + unmarshal block and wrap it in `RetryWithBackoff(ctx, 3, fmt.Sprintf("greenhouse:%s", company), func() error { ... })`, moving the existing fetch/decode logic inside the closure and returning its error from there instead of directly. Preserve all existing logging and the `isInternship()` filtering logic exactly as-is — only the retry wrapping changes.

- [ ] **Step 2: Wrap the GitHub README fetch**

In `github_scraper.go`'s `ScrapeSimplifyRepo`, wrap each branch-URL fetch attempt in `RetryWithBackoff(ctx, 3, "github:simplify-readme", func() error { ... })` the same way — the existing two-branch fallback logic (try `master`, then `dev`) stays, but each individual branch fetch now retries transient failures before falling through to the next branch.

- [ ] **Step 3: Run the full Go test suite**

Run: `go test ./... -v`
Expected: all existing tests still pass (this task doesn't add new test cases — it's wrapping existing, already-tested-at-integration-level fetch calls; if `greenhouse_scraper.go`/`github_scraper.go` have existing unit tests with mocked HTTP clients, verify those still pass unchanged since the retry wrapper only engages on actual errors).

- [ ] **Step 4: Commit**

```bash
git add services/scraper-worker/scraper/greenhouse_scraper.go services/scraper-worker/scraper/github_scraper.go
git commit -m "fix: add retry logic to Greenhouse and GitHub scrapers"
```

---

### Task 8: Externalize scraper company config to JSON

**Files:**
- Create: `services/scraper-worker/config/sources.json`
- Modify: `services/scraper-worker/config/config.go`

**Interfaces:**
- Produces: `Load()`'s existing return type (`*Config`) unchanged — this task changes *where the data comes from*, not the shape consumed by callers.

- [ ] **Step 1: Export current hardcoded lists to JSON**

Read `config/config.go`'s existing `GreenhouseSource`/`LeverSource` struct definitions and hardcoded slices in full. Write `config/sources.json` as an exact JSON export of that data, e.g.:

```json
{
  "greenhouse": [
    { "company": "Stripe", "boardToken": "stripe" }
  ],
  "lever": [
    { "company": "Netflix", "slug": "netflix" }
  ]
}
```

(Use the real field names matching `GreenhouseSource`/`LeverSource`'s actual struct tags, and populate every entry currently hardcoded — this must be a complete, lossless export, not a sample.)

- [ ] **Step 2: Add a loader with embedded-defaults fallback**

In `config.go`, add a function that attempts to read `config/sources.json` (or a path from an env var, e.g. `SOURCES_CONFIG_PATH`, defaulting to `config/sources.json`) via `os.ReadFile` + `encoding/json.Unmarshal` into the same `GreenhouseSource`/`LeverSource` slice types. If the file doesn't exist or fails to parse, log a warning and fall back to the existing embedded hardcoded slices (keep those in the source as the fallback — don't delete them). Wire this into `Load()` so it's used instead of the hardcoded slices when the file is present and valid.

- [ ] **Step 3: Verify the JSON round-trips correctly**

Run: `go run ./... ` isn't practical without full env setup — instead write a focused check: a small `go test` that calls the new loader function directly against `config/sources.json` and asserts the returned slice length matches the previous hardcoded slice length exactly (a regression guard that the JSON export didn't drop any companies). Add this as `config/config_test.go` if one doesn't already exist.

Run: `go test ./config/... -v`
Expected: PASS, company count matches.

- [ ] **Step 4: Commit**

```bash
git add services/scraper-worker/config/sources.json services/scraper-worker/config/config.go services/scraper-worker/config/config_test.go
git commit -m "feat: externalize scraper company list to sources.json"
```

---

### Task 9: Workday date-parse fix + Greenhouse posted_at investigation

**Files:**
- Modify: `services/scraper-worker/scraper/workday_scraper.go`
- Modify: `services/scraper-worker/scraper/greenhouse_scraper.go`

**Interfaces:**
- No new interfaces — bug fixes within existing functions.

- [ ] **Step 1: Fix the silent Workday date-parse failure**

In `workday_scraper.go`, find `postedAt, _ := time.Parse("2006-01-02", ...)` (the error is currently discarded, producing a zero-value `time.Time{}` on parse failure rather than a proper nil/unknown). Change to handle the error explicitly:

```go
var postedAtPtr *time.Time
if parsed, err := time.Parse("2006-01-02", postedOnRaw); err == nil {
    postedAtPtr = &parsed
} else {
    log.Warn().Err(err).Str("raw_value", postedOnRaw).Msg("failed to parse Workday posted date, leaving unset")
}
```

Use whatever the surrounding code's actual variable name for the raw string is (confirm exact current code before editing — research found this at `workday_scraper.go:98,109`) and match the existing `Job` struct's field type (`*time.Time` per the pattern established elsewhere in the scraper, e.g. `lever_scraper.go`).

- [ ] **Step 2: Investigate Greenhouse's API for a true "first published" field**

Fetch a live sample from `https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true` (or any of the configured companies) — either via `curl` directly or by reading Greenhouse's public API docs — and check whether the job payload includes a field like `first_published` distinct from `updated_at`. If it exists, change `greenhouse_scraper.go`'s `PostedAt = ghJob.UpdatedAt` assignment to prefer `first_published` when present, falling back to `updated_at` otherwise. If no such field exists in the actual API response, leave the existing `updated_at` behavior as-is and note in the commit message that this was investigated and no better field was found — don't guess at a field name that might not exist.

- [ ] **Step 3: Run the full Go test suite**

Run: `go test ./... -v`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add services/scraper-worker/scraper/workday_scraper.go services/scraper-worker/scraper/greenhouse_scraper.go
git commit -m "fix: Workday silent date-parse failure; investigate Greenhouse posted-date accuracy"
```

---

### Task 10: Dead-listing purge

**Files:**
- Modify: `services/scraper-worker/repository/job_repository.go`
- Modify: `services/scraper-worker/main.go`

**Interfaces:**
- Produces: `JobRepository.PurgeOldClosedJobs(olderThan time.Duration) (int64, error)` — deletes (not just marks) `CLOSED` jobs whose `scraped_at` is older than the cutoff, returns count deleted.

- [ ] **Step 1: Add the purge method**

In `job_repository.go`, add (matching the existing style of `MarkStaleJobsAsClosed`):

```go
func (r *JobRepository) PurgeOldClosedJobs(olderThan time.Duration) (int64, error) {
	cutoff := time.Now().Add(-olderThan)
	result, err := r.db.Exec(
		`DELETE FROM jobs WHERE status = 'CLOSED' AND scraped_at < $1`,
		cutoff,
	)
	if err != nil {
		return 0, fmt.Errorf("purging old closed jobs: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("getting purge rows affected: %w", err)
	}
	return rowsAffected, nil
}
```

Match the exact `sql.DB`/`sql.Tx` field name and error-wrapping style already used in this file (confirm before finalizing — don't assume `r.db` is the correct field name without checking).

- [ ] **Step 2: Wire it into the 12h cron**

In `main.go`, find the existing `@every 12h` cron function (which currently calls `MarkStaleJobsAsClosed` and the URL checker). Add a call to `PurgeOldClosedJobs(90 * 24 * time.Hour)` in the same function, after the stale-marking step (so jobs get a chance to be marked `CLOSED` before the purge threshold considers them), logging the count of purged rows.

- [ ] **Step 3: Run the full Go test suite**

Run: `go test ./... -v`
Expected: all tests pass.

- [ ] **Step 4: Manual verification**

Since this deletes data, verify against a non-production database first: insert a test row with `status='CLOSED'` and `scraped_at` set to 100 days ago, run the purge function directly (or trigger the cron manually if the binary supports a manual-run flag — check `main.go` for one), confirm the row is gone and nothing else was touched.

- [ ] **Step 5: Commit**

```bash
git add services/scraper-worker/repository/job_repository.go services/scraper-worker/main.go
git commit -m "feat: purge closed job listings older than 90 days"
```

---

### Task 11: Frontend — honest date labels, job card tags, fixed memo comparator

**Files:**
- Modify: `services/frontend/components/JobListRow.tsx`
- Modify: `services/frontend/lib/api.ts` (job listing response type — add `companyTier`, `ghostScore`, `experienceLevel`)

**Interfaces:**
- Consumes: `companyTier`, `ghostScore`, `experienceLevel` fields added to the job listing API response in Task 6.

- [ ] **Step 1: Update the job listing response type in `api.ts`**

Find `getJobs`/`listJobs` (whatever the method backing the homepage listing is called) and add `companyTier: string | null; ghostScore: number | null; experienceLevel: string | null;` to its response item type, matching the backend fields added in Task 6.

- [ ] **Step 2: Add "Added" vs "Posted" honest date labeling**

In `JobListRow.tsx`, find where the date is rendered (uses `postedAt` falling back to `scrapedAt` per existing behavior). Change the label logic so that when `postedAt` is null/absent (meaning the displayed date is actually `scrapedAt`), the prefix reads "Added" instead of "Posted":

```tsx
const dateLabel = job.postedAt ? 'Posted' : 'Added';
const displayDate = job.postedAt ?? job.scrapedAt;
```

Use this in place of whatever hardcoded "Posted" text currently precedes the relative-time display.

- [ ] **Step 3: Add company tier / New Grad / Ghost Score tags**

Add small tag/badge elements to the card, following the existing tag styling already present in this file (check how any existing tags — e.g. employment type — are styled and match that pattern rather than introducing a new visual style). Render conditionally:
- Company tier badge when `job.companyTier` is non-null (e.g. "FAANG" or "UNICORN" text badge).
- "New Grad" badge when `job.experienceLevel === 'NEW_GRAD'`.
- Ghost Score indicator when `job.ghostScore` is non-null and above some notable threshold (e.g. only show if `ghostScore > 50`, to avoid cluttering every card with a low/irrelevant score) — use judgment on the exact threshold/visual treatment, but don't show a Ghost Score badge for every single job regardless of score, since a near-zero ghost score isn't informative enough to warrant a permanent badge.

- [ ] **Step 4: Fix the memo comparator**

Find the custom `React.memo` comparator (research found it only checks `applyUrl, postedAt, alreadyApplied, jobStatus, isSaved`). Add `companyTier, ghostScore, experienceLevel, matchPercentage, matchPercentile, techStack` to the fields it compares, so the card actually re-renders when any of this new (or previously-broken) data changes.

- [ ] **Step 5: Type-check**

Run: `cd services/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Start the frontend dev server, load the homepage listing, and visually confirm: date labels read "Added" for Simplify-sourced jobs (no `postedAt`) and "Posted" for Greenhouse/Lever-sourced jobs; company tier badges appear for known FAANG/unicorn companies; New Grad badges appear where expected; Ghost Score badges only appear above the chosen threshold.

- [ ] **Step 7: Commit**

```bash
git add services/frontend/components/JobListRow.tsx services/frontend/lib/api.ts
git commit -m "feat: honest date labels and job card tags (company tier, New Grad, Ghost Score)"
```

---

## Self-Review Notes

- **Spec coverage:** apply flow (Task 1), tracker N+1 + dead enum + deadline/notes (Tasks 2-4), scraper reliability + externalized config + Workday/Greenhouse date fixes (Tasks 7-9), New Grad classification (Task 5), company tier + Ghost Score (Task 6), dead-listing purge (Task 10), job card UI + honest dates (Task 11) — all covered.
- **Type consistency:** `ClassifyExperienceLevel` return values (`"INTERN"`/`"NEW_GRAD"`/`"SENIOR"`/`"UNKNOWN"`) are used identically in Task 5's Go code and Task 11's frontend check (`experienceLevel === 'NEW_GRAD'`). `CompanyTier.lookup` return values (`"FAANG"`/`"UNICORN"`/`null`) are used consistently across Task 6 and Task 11.
- **Known uncertainties flagged inline for implementers to confirm against live code rather than guess:** the exact field name for the DB handle in `job_repository.go` (Task 10), the exact location/name of `JobSummaryResponse` (Tasks 6, 11), the exact ghost-score computation method name (Task 6), `useAuth`'s exact contract (Task 1), and whether Greenhouse's API actually exposes a `first_published`-style field (Task 9) — each of these is called out as "confirm before finalizing" rather than asserted as fact, since the research pass found the surrounding code but not always the single authoritative name.
- **Out of scope for this plan:** `workday_adapter.go` (dead/unused, not touched), `JobCard.tsx` (dead component, not touched), AWS/Kafka/Databricks (separate sub-projects).
