# Deterministic Resume Grading & Virality — Design

Status: Approved for planning
Sub-project: 1 of 4 (Virality/gamification), part of the broader JobDog infra + feature overhaul
Owner context: prioritizing this sub-project first because it produces the most demo-able,
portfolio-visible output for a New Grad SWE application (target audience includes Disney
Streaming).

## Goal

Turn JobDog's existing resume analysis into a scoring system that is:
1. **Deterministic** — identical resume text (and identical job context, if scoped to a job)
   always produces the identical score and tier.
2. **Accurate** — leans on rule-based sub-scores where a rule can do the job, rather than
   asking an LLM to "opine" on things that are objectively computable.
3. **Shareable** — produces a branded, customizable image (9:16 and 1:1) users want to post,
   and a head-to-head "Resume Battle" comparison feature.

Fix the resume vault delete bug in the same pass since this spec already touches the vault UI
and resume domain heavily.

## Background / current state

- `RoastService` (`services/backend-api/.../roast/RoastService.java`) already implements a
  dog-themed tier system (ALPHA_DOG, GOOD_BOY, FETCH_PLAYER, HOUSE_TRAINED, LOST_PUPPY,
  POUND_CANDIDATE via `rankToTier`), driven by a single non-deterministic LLM call
  (`gpt-4o-mini`, temperature 0.8) that returns both a score (`top_dog_rank`) and flavor text
  (`brutal_roast_text`). This is reused/reworked, not replaced wholesale — the tier names and
  roast-text personality stay.
- `ApplicationService.computeScore` (`services/backend-api/.../application/ApplicationService.java:152-174`)
  already implements a fully deterministic, rule-based match score (60% required-skill
  coverage + 15% preferred-skill coverage + 15% experience alignment + 10% education
  alignment) against `resume_profiles` vs `job_requirement_profiles`. The new grading pipeline
  reuses this coverage/alignment logic rather than re-deriving it.
- `ResumeAnalysisService` (deep analysis: overall_score, ats_score, A–F grades) and
  `ResumeJobFit` (LLM-scored job fit, cached per resume+job in Postgres, not Redis) are
  separate existing LLM-based scoring paths that remain as-is; they are not touched here beyond
  being pulled into the share card for the job-fit toggle.
- Redis (`CacheConfig.java`) currently caches jobs/job-details only, with a 10/5/15 min TTL —
  no resume scoring caching exists today.
- `benchmark` package already has percentile-ranking infrastructure
  (`ApplicationScoreEntity.percentile`, `BenchmarkService`, seeded FAANG/unicorn benchmark
  jobs) that Resume Battle's social phase reuses.
- Public share page `services/frontend/app/u/[userId]/page.tsx` exists today with a basic
  "copy link" share button and no image generation. `@vercel/og` is not present anywhere in
  the repo yet.
- **Delete bug**: `ResumeService.deleteResume` calls `resumeRepository.delete(resume)`
  directly with no cascade handling. `resume_profiles`, `applications`, `resume_analyses`, and
  `resume_job_fits` all have `resume_id` FK columns with no `ON DELETE CASCADE`
  (`V1__init_schema.sql`, `V5__resume_analysis.sql`). Deleting any resume that has ever been
  parsed (which happens automatically, async, right after upload) throws a
  `DataIntegrityViolationException`, which `GlobalExceptionHandler` turns into an opaque 500.
  The frontend vault page just `alert()`s the raw error.

## Design

### 1. Deterministic scoring pipeline

Replace `RoastService.roast`'s scoring with a new `ResumeGradingService.grade(userId, resumeId, jobId?)`:

**Cache-guaranteed determinism.** Compute `contentHash = SHA-256(normalizedResumeText + "|" + (jobId ?? "general"))`, where `normalizedResumeText` is the PDF-extracted text with whitespace/casing normalized (so trivial re-extraction differences don't cause cache misses). Look up `contentHash` in Redis first:
- **Hit** → return the cached `GradeResult` (score, tier, sub-scores, roast text) directly. No OpenAI call.
- **Miss** → compute fresh (below), store in Redis under `contentHash` with no TTL (a resume's extracted text is immutable once uploaded), and persist to `roast_history` (gains a new `content_hash` column, indexed, for durability/audit — Redis is the fast path, Postgres is the record of truth).

**Score composition (0–100), hybrid:**
| Component | Weight | Method |
|---|---|---|
| Required skill coverage | 45% | Deterministic — reuse `ApplicationService` coverage() logic against `resume_profiles.skills` |
| Preferred skill coverage | 15% | Deterministic — same coverage() logic |
| Experience alignment | 15% | Deterministic — reuse `experienceAlignment()` |
| Education alignment | 10% | Deterministic — reuse `educationAlignment()` |
| Writing/impact quality | 15% | LLM-scored, `gpt-4o-mini`, temperature 0, OpenAI structured outputs (`response_format: json_schema`) constraining the response to `{ "writing_quality_score": 0-100, "top_pros": string[3] }` |

When `jobId` is null (general New Grad SWE grading, no specific job), required/preferred skill
coverage is computed against a generic "New Grad SWE" skill baseline (reuse the calibration
already embedded in `RoastService`'s general-roast prompt, expressed as a skill list constant)
instead of a real job's requirement profile.

Final `topDogRank` = round(weighted sum). `tierName = rankToTier(topDogRank)` — thresholds
unchanged (90/75/60/40/20).

The `brutal_roast_text` flavor field stays a separate LLM call (temperature 0.8, existing
prompt/persona unchanged), generated and cached alongside the score under the same
`contentHash` — it's cosmetic copy shown in the UI, not a claimed metric, so it doesn't need
to be deterministic; only `topDogRank`/`tierName` and the sub-scores do.

**API surface change:** `POST /api/v1/roast` keeps its request/response shape (`resumeId`,
optional `jobId` → `brutalRoastText`, `missingDependencies`, `topDogRank`, `tierName`) so the
frontend integration point doesn't change; response gains `subScores` (the four weighted
components) and `topPros` (from the writing-quality LLM call) for the new share-card
customization step.

### 2. Resume vault delete fix

In `ResumeService.deleteResume`, inside the existing `@Transactional`, before deleting the
`ResumeEntity`:
1. Check for `applications` referencing this `resumeId`. If any exist, throw a new
   `ResumeInUseException` → mapped to `409 Conflict` with a message
   ("resume is attached to N application(s); remove those first") instead of letting the FK
   violation surface as a generic 500.
2. Delete dependent rows with no user-facing meaning of their own, in FK-safe order:
   `resume_job_fits` → `resume_analyses` → `roast_history` → `resume_profiles`.
3. Best-effort R2 object delete (unchanged from today).
4. Delete the `ResumeEntity`.

Frontend (`app/vault/page.tsx`) delete handler updates to show the 409's message directly
instead of the current generic `alert('Failed to delete resume: ...')`.

### 3. Shareable image generation

New route `services/frontend/app/api/og/resume-card/route.tsx`, Edge runtime, `@vercel/og`'s
`ImageResponse`. Query params: `score`, `tier`, `ratio` (`9:16` | `1:1`), plus optional
`showPros`, `showJobFit`, `showSubScores`, `showPercentile`, `showHandle` — all booleans
controlling which optional blocks render; the corresponding data (top pros, best job-fit +
role, sub-score breakdown, percentile) is fetched by the calling page and passed through as
additional query params (values only — the route itself does no DB/auth work, keeping it a
pure rendering endpoint).

Card always renders: score, tier name + dog emoji, JobDog wordmark. A pre-share bottom sheet
(new client component, opened from the roast result view and from the vault) presents toggles
for: top-3 AI "Pros", best job-fit score + matching role, sub-score breakdown (small bar
chart), percentile rank among JobDog users for that job (via `benchmark` percentile data),
and show/hide username — building the query string for the OG route live so the sheet shows a
preview. Download via canvas-to-PNG; native Web Share API where available, falling back to
"copy link" consistent with the existing `u/[userId]` share button.

### 4. Resume Battle (phased)

**Phase A — self-battle (in scope for this spec).** New page
`services/frontend/app/battle/page.tsx`: pick two of the user's own resumes (+ optional shared
job context), call `POST /api/v1/roast` for each (cache makes repeat comparisons instant), render
a side-by-side view of overall score, tier, and the four sub-scores. No new backend endpoint —
pure client-side composition of two existing grading calls.

**Phase B — social leaderboard (stretch, lower priority, same spec).** New endpoint
`GET /api/v1/benchmarks/{jobId}/percentile` returning the current distribution of
`application_scores.percentile` for that job (reusing existing `benchmark` package data),
surfaced in the battle UI and on the share card's percentile toggle as "top X% of JobDog users
for this role."

## Data model changes

- `roast_history`: add `content_hash VARCHAR(64) NOT NULL`, indexed (Flyway migration).
- No other schema changes; sub-scores and top-pros are computed/returned, not persisted as new
  columns (they're derivable from the same grading pass and stored as part of the existing
  `roast_history` JSON-ish fields, extending `missing_dependencies`-style storage).

## Testing

- Backend: unit tests for each deterministic sub-score function (pure, exact-value assertions);
  a Redis cache-hit test (same `contentHash` → second call makes zero OpenAI requests, via a
  mocked `OpenAiService`); a delete-cascade integration test covering (a) a resume with
  profile+analysis+job-fit+roast-history deletes cleanly, and (b) a resume attached to an
  application is rejected with 409.
- Frontend: component/snapshot test for the OG route's rendered output across the ratio and
  toggle combinations; manual verification that toggle state in the customization sheet
  matches what renders in the downloaded image.

## Out of scope (deferred to other sub-projects)

- AWS migration, Kafka/Databricks streaming pipeline, "Trending Keywords" widget.
- Job card UI refactor / contextual tags, New Grad ingestion focus, dead-listing purge.
