# Core Feature Refactor — Design

Status: Approved for planning
Sub-project: 2 of 4 (Core feature refactor), part of the broader JobDog infra + feature overhaul
Owner context: product owner flagged the job listing/tracking/apply system as "deeply flawed"
after using it; investigation (Explore agent, read-only) confirmed several concrete bugs plus
architectural gaps. This spec covers both the confirmed bugs and the original core-refactor scope
(job card UI, dead-listing purge, New Grad focus).

## Goal

Fix confirmed correctness bugs in the apply flow and application tracker, improve scraper
reliability and source accuracy, and refresh the job browsing experience around New Grad SWE
roles specifically.

## Background — investigation findings

An Explore agent read-only investigation (not itself part of this spec) established:

- **Posted date**: DB schema, API, and frontend all correctly handle `postedAt` when present.
  Greenhouse and Lever scrapers capture real dates. The GitHub/Simplify scraper (the primary
  internship source) hard-codes `PostedAt: nil` — Simplify's source README has no per-listing
  date to parse, so this is a structural source limitation, not a code bug. Workday has a
  silent date-parse failure but is disabled by default.
- **Scraping architecture**: Go + the worker-pool pattern (`services/scraper-worker/`) is sound;
  no case for migrating off it. Concrete gaps: Greenhouse/GitHub scrapers lack retry logic
  (Lever/Workday have it via `RetryWithBackoff`); the ~95-company source list is hard-coded in
  Go source, requiring a redeploy to change; the README's claimed SHA-256 dedup mechanism is
  inaccurate documentation (actual dedup is a working `source_url` uniqueness constraint).
- **Apply button**: two confirmed bugs. (1) The job detail page (`/jobs/[jobId]`) uses a bare
  `<a href={applyUrl}>` that bypasses `ApplyModal` entirely — no application record is ever
  created for that path, unlike the homepage listing's Apply button. (2)
  `ApplicationResponse.message` (backend) vs. `earlyApplicantMessage` (frontend) field-name
  mismatch means the early-applicant congratulation banner has never rendered.
- **Application tracker**: confirmed N+1 query (`ApplicationService.listApplications` — roughly
  `1 + 3N` queries per page load from lazy `job`/`resume`/`score` associations with no
  `JOIN FETCH`). `ApplicationStatus` enum has three dead values (`RUNNING`, `ORPHANED`, `KILLED`)
  that appear copy-pasted from an unrelated domain and are never set anywhere. Deadline/notes
  fields are stored in browser `localStorage` only — not synced across devices, lost on clear.
- **Ghost Score**: a fully built backend feature (`/api/v1/ghost-score`) never surfaced in the
  job card UI.
- **Dead listings**: the active-listing query already filters by `status=ACTIVE` correctly (no
  visible-to-users bug), but `CLOSED` jobs accumulate in the table indefinitely with no purge.

## Design

### 1. Apply flow fixes
- Replace the job detail page's bare `<a href>` Apply button with the same `ApplyModal` flow the
  homepage listing uses, so every apply path creates a trackable `ApplicationEntity`.
- Fix the `message`/`earlyApplicantMessage` field-name mismatch (rename on one side to match the
  other) so the early-applicant banner renders as designed.

### 2. Application tracker fixes
- Replace `ApplicationService.listApplications`'s per-row lazy-loading with a batch-fetch
  (`JOIN FETCH` or `@EntityGraph` covering `job`, `resume`, and a batched score lookup) to
  eliminate the N+1 pattern.
- Remove `RUNNING`, `ORPHANED`, `KILLED` from `ApplicationStatus` (confirmed unused anywhere).
- Add backend support for deadline + notes: new nullable columns on `applications` (or a small
  side table), a PATCH endpoint to update them, migrate the existing tracker UI off
  `localStorage` onto real persistence. One-time client-side migration isn't needed — this data
  was always ephemeral/local, so existing localStorage values are simply superseded going
  forward (acceptable, low-stakes data per the localStorage-only nature already implied it
  wasn't treated as durable).

### 3. Scraper reliability & source accuracy
- Add retry logic to the Greenhouse and GitHub scrapers, matching the existing
  `RetryWithBackoff` helper already used by Lever/Workday.
- Externalize the company/source list from hard-coded Go source into a config file
  (JSON or YAML, loaded at startup) so adding, removing, or fixing a source is a config change,
  not a code change + redeploy. This directly supports the New Grad focus and dead-listing
  purge goals below by making source curation cheap.
- Investigate Greenhouse's API for a "first published" style field as a more accurate posted-date
  source than `updated_at` (which currently misrepresents reposted/edited listings as freshly
  posted); use it if available, otherwise keep `updated_at` as the best available proxy.
- Fix Workday's silent date-parse failure (don't let a parse error produce a bogus zero-value
  date). Attempt to configure and enable a handful of real Workday-based employers — this was
  reportedly difficult before, so timebox the investigation; if it proves too fragile within
  that timebox, ship the bug fix (safe regardless) and leave Workday disabled rather than block
  the rest of this plan on it.
- Frontend: when a job has no `postedAt` (i.e., Simplify-sourced), label its date as "Added
  {relative time}" instead of implying "Posted {relative time}" — honest about what's actually
  known.

### 4. Job card UI + New Grad focus
- Modernize the job card component with contextual tags: company tier (FAANG/mid-size/startup —
  reusing categorization already present in the `benchmark` package), remote/onsite, New
  Grad/Intern classification, and the previously-unsurfaced Ghost Score.
- Extend the existing keyword-based skill extraction (`scraper/skills.go`) to also classify
  experience level (intern / new-grad / senior) from job title + description, giving the "shift
  focus to New Grad roles" goal a real classification signal to filter/sort on, rather than
  relying solely on which sources are scraped.
- Add a purge job: hard-delete (or move to an archive table, TBD at planning time based on
  whether historical data has any use) `CLOSED` jobs older than 90 days, run on the existing
  12h cron alongside the current stale-marking/URL-check pass.

## Testing
- Backend: unit tests for the N+1 fix (assert query count via a Hibernate statistics assertion
  or equivalent), the apply-flow field-name fix, the experience-level classifier's keyword
  logic, and the purge job's age-based deletion boundary.
- Scraper (Go): unit tests for the retry logic paths (success-after-retry, exhausted-retries),
  the Workday date-parse fix, and the externalized-config loader.
- Frontend: manual verification of the unified apply flow from both the homepage and job detail
  page, the early-applicant banner rendering, the "Added" vs "Posted" date label, and the new
  job card tags (company tier, New Grad badge, Ghost Score).

## Out of scope (deferred to other sub-projects)
- AWS infra (complete, separate sub-project).
- Kafka/Databricks streaming pipeline, "Trending Keywords" widget (sub-project 4, not started).
- Virality/gamification features (complete, separate sub-project).
