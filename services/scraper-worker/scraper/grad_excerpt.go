package scraper

import (
	"regexp"
	"strings"
)

// maxExcerptChars bounds what we send to the model. Job descriptions run to
// several thousand characters, but eligibility language is concentrated in a
// handful of sentences — sending the whole thing would multiply token cost
// roughly sixfold for no gain in classification accuracy.
const maxExcerptChars = 2400

// eligibilityPattern matches the sentences that actually decide the cohort:
// graduation requirements, degree completion, years of experience, and start
// dates. Everything else in a posting — benefits, company boilerplate, the
// day-to-day responsibilities — is noise for this question.
var eligibilityPattern = regexp.MustCompile(`(?i)graduat|degree|diploma|class of|commencement|` +
	`years?\s+of\s+experience|year\s+experience|experience\s+required|` +
	`new grad|entry[- ]level|early career|campus|university|student|intern|` +
	`start date|starting|cohort|eligib|must be|must have|qualificat|requirement`)

// EligibilityExcerpt reduces a job description to the sentences bearing on
// graduation-cohort eligibility, preserving their original order.
//
// Returns "" when nothing matches, which the caller should treat as "not worth a
// model call" — a description with no eligibility language anywhere gives the
// model nothing to reason about, and paying for that call would buy a guess.
func EligibilityExcerpt(description string) string {
	if strings.TrimSpace(description) == "" {
		return ""
	}

	var kept []string
	used := 0

	for _, sentence := range splitSentences(description) {
		trimmed := strings.Join(strings.Fields(sentence), " ")
		if trimmed == "" {
			continue
		}
		if !eligibilityPattern.MatchString(trimmed) {
			continue
		}

		// Stop at the budget rather than truncating mid-sentence: a half sentence
		// can invert its own meaning ("must have graduated before" / "...2026").
		if used+len(trimmed)+1 > maxExcerptChars {
			break
		}
		kept = append(kept, trimmed)
		used += len(trimmed) + 1
	}

	return strings.Join(kept, ". ")
}
