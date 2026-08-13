package scraper

import "regexp"

// leadershipTitlePattern matches roles that are unambiguously out of scope for an
// early-career board regardless of description — management and executive titles.
var leadershipTitlePattern = regexp.MustCompile(`(?i)\b(vp|svp|evp|chief|head of|president|partner)\b|\bdirector\b|\bmanager\b`)

// IsEarlyCareerRelevant decides whether a posting is worth ingesting.
//
// It filters by exclusion rather than inclusion, and that is the whole point.
// The previous rule kept only titles containing "intern" or "co-op", which threw
// away every new-grad role at ingestion — "Software Engineer, New Grad" does not
// contain "intern". On a representative Greenhouse board that rule kept 2 of 182
// postings; dropping only senior and leadership titles keeps 47.
//
// Deciding what a posting actually targets needs the description, and that is
// what the cohort classifier is for. Filtering hard at ingest destroys the input
// that classification depends on, and a discarded posting cannot be recovered
// without re-scraping. So the ingest filter only removes what a title alone can
// settle; entry_type does the real work at query time.
func IsEarlyCareerRelevant(title string) bool {
	if title == "" {
		return false
	}
	// An internship is in scope even when its title also reads senior
	// ("Senior Thesis Intern" and similar).
	if internPattern.MatchString(title) {
		return true
	}
	if seniorTitlePattern.MatchString(title) {
		return false
	}
	if leadershipTitlePattern.MatchString(title) {
		return false
	}
	return true
}
