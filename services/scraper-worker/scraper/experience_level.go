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
