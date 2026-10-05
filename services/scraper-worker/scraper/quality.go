package scraper

import (
	"regexp"
	"strconv"
	"time"

	"jobdog/scraper-worker/models"
)

// SourceTrust says how far a source's own curation can be relied on to have
// already scoped its postings to the audience this board serves.
type SourceTrust int

const (
	// TrustNone is a company's whole board — Greenhouse, Lever, Ashby, or a
	// general Workday site. Every role the company hires for is in there, so a
	// posting has to show its own early-career signal to be worth keeping.
	TrustNone SourceTrust = iota

	// TrustCurated is a source someone has already scoped to early-career
	// roles: a community aggregator list (SimplifyJobs, vanshb03) or a
	// campus/university Workday site. The list being the signal, a posting only
	// has to not contradict it.
	TrustCurated
)

// techTitlePattern is a cheap "could this be a software/data/engineering
// role" test on a title. It only has to rule out the plainly unrelated —
// nurses, drivers, account executives — not decide seniority; that is what
// the cohort classifier is for.
var techTitlePattern = regexp.MustCompile(`(?i)\b(software|swe|sde|sdet|engineer|engineering|developer|programmer|devops|sre|site reliability|full[- ]?stack|front[- ]?end|back[- ]?end|data|machine learning|ml|ai|security|cloud|platform|infrastructure|systems?|embedded|firmware|mobile|ios|android|web|computer|research scientist|applied scientist|analytics?|qa|test automation)\b`)

// IsTechTitle reports whether a title could plausibly belong to a
// software/data/engineering role.
func IsTechTitle(title string) bool {
	return techTitlePattern.MatchString(title)
}

// AcceptListing is the single ingest gate every scraper runs a posting
// through before it is stored (or published to Kafka).
//
// The board's promise is "new grad, entry level, and internship software
// roles". Everything the old pipeline kept beyond that — it filtered on the
// way out, at query time — was scraped, stored, liveness-checked and
// classified for nothing: tens of thousands of rows of which a few thousand
// were ever shown, and a scraper whose memory footprint grew with every
// megacorp board it crawled. Deciding here, once, in one place, keeps the
// database the size of the product.
//
// The rule is inclusion, not exclusion: a posting is kept only if it is
// affirmatively early-career — an internship, a cohort-gated new-grad role,
// or an open entry-level one — or it comes from a source that has already
// curated for that. "Not obviously senior" is not enough; that is how a
// Principal Engineer's neighbour, "Software Engineer III", got through.
func AcceptListing(job *models.Job, trust SourceTrust) (bool, string) {
	if !IsEarlyCareerRelevant(job.Title) {
		return false, "senior or leadership title"
	}
	if IsPastSeason(job.Title, time.Now()) {
		return false, "past season"
	}
	if trust == TrustNone && !IsTechTitle(job.Title) {
		return false, "not a technical role"
	}

	verdict := ClassifyGradCohort(job.Title, job.DescriptionText, job.SourceURL, job.SourceRepo)
	switch verdict.EntryType {
	case EntryTypeIntern, EntryTypeNewGradCohort, EntryTypeEntryLevelOpen:
		return true, ""
	case EntryTypeExperienced:
		return false, "experienced role"
	}

	// No signal either way.
	if trust == TrustCurated {
		return true, ""
	}
	return false, "no early-career signal"
}

// TitleHasEarlyCareerSignal reports whether a title alone announces an
// early-career role. Used where only a title is available (a Workday search
// result, before the detail fetch) to decide whether a result is worth
// following.
func TitleHasEarlyCareerSignal(title string) bool {
	if internPattern.MatchString(title) {
		return true
	}
	return entryTitlePattern.MatchString(title) || cohortLanguagePattern.MatchString(title)
}

var (
	yearInTitlePattern = regexp.MustCompile(`\b(20[2-3][0-9])\b`)
	summerPattern      = regexp.MustCompile(`(?i)\bsummer\b`)
)

// IsPastSeason reports whether a title names a hiring season that is over: a
// year before the current one ("New Grad 2025"), or this year's summer once
// summer has ended ("Summer 2026 Intern" in October). Companies routinely
// leave these postings up long after the cycle closed, so the ATS still
// lists them and no liveness check will ever flag them.
func IsPastSeason(title string, now time.Time) bool {
	latest := 0
	for _, match := range yearInTitlePattern.FindAllString(title, -1) {
		year, err := strconv.Atoi(match)
		if err == nil && year > latest {
			latest = year
		}
	}
	if latest == 0 {
		return false
	}
	if latest < now.Year() {
		return true
	}
	return latest == now.Year() && now.Month() >= time.September && summerPattern.MatchString(title)
}
