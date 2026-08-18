package scraper

import (
	"regexp"
	"strconv"
	"strings"
)

// EntryType is the coarse bucket a posting falls into once graduation-eligibility
// language has been taken into account. It deliberately separates the two cases
// ClassifyExperienceLevel conflates into "NEW_GRAD":
//
//   - NEW_GRAD_COHORT   — the posting is gated on a graduation window ("class of
//     2027", "graduating between Dec 2026 and Jun 2027"). Only that cohort can apply.
//   - ENTRY_LEVEL_OPEN  — junior/level-1 req with no graduation gate. Anyone with
//     roughly 0-3 years can apply and the start date is usually immediate. These are
//     the postings that pollute new-grad lists.
type EntryType string

const (
	EntryTypeNewGradCohort  EntryType = "NEW_GRAD_COHORT"
	EntryTypeEntryLevelOpen EntryType = "ENTRY_LEVEL_OPEN"
	EntryTypeIntern         EntryType = "INTERN"
	EntryTypeExperienced    EntryType = "EXPERIENCED"
	EntryTypeUnknown        EntryType = "UNKNOWN"
)

// Classification sources, recorded so we can tell a cheap deterministic verdict
// apart from an LLM one when auditing or re-running.
const (
	GradSourceRegex = "REGEX"
	GradSourceLLM   = "LLM"
	GradSourceNone  = "NONE"
)

// GradClassification is the full verdict for one posting.
type GradClassification struct {
	EntryType EntryType
	// YearMin/YearMax bound the graduation window the posting accepts, as calendar
	// years. Both are 0 when no window was found. A single-year cohort has
	// YearMin == YearMax.
	YearMin int
	YearMax int
	// RelativeWindow is true when the posting gates on graduation but expresses it
	// relative to the start date ("within 12 months of graduating") rather than as
	// calendar years, so YearMin/YearMax stay 0.
	RelativeWindow bool
	// MinYearsExperience is the smallest "N+ years of experience" requirement found,
	// or -1 when the description states none.
	MinYearsExperience int
	// Evidence is the sentence the graduation window was read out of, kept so the UI
	// and any later audit can show why a job was tagged with a cohort.
	Evidence   string
	Source     string
	Confidence float64
}

// plausibleGradYears bounds which 4-digit years we are willing to read as a
// graduation year. Anything outside this is a copyright line, a fiscal year, or a
// street address, not a cohort.
const (
	minPlausibleGradYear = 2020
	maxPlausibleGradYear = 2035
)

var (
	yearPattern = regexp.MustCompile(`\b(20[2-3][0-9])\b`)

	// Sentences that mention graduating, a degree, or a cohort are the only ones we
	// harvest years from.
	gradContextPattern = regexp.MustCompile(`(?i)graduat|class of|commencement|degree|diploma|matriculat|conferr`)

	// Boilerplate that also happens to carry a year. Skip these outright.
	yearNoisePattern = regexp.MustCompile(`(?i)copyright|\x{00A9}|all rights reserved|fiscal year|equal opportunity|©`)

	// "must graduate within 12 months", "graduated within the last year".
	relativeGradPattern = regexp.MustCompile(`(?i)(graduat\w*|degree)[^.;!?]{0,80}?within\s+(the\s+(last|past)\s+)?\d+\s*(months?|years?)`)

	// "5+ years", "3-5 years", "minimum of 2 years" — captured near an experience mention.
	yearsExperiencePattern = regexp.MustCompile(`(?i)(\d{1,2})\s*(?:\+|plus)?\s*(?:-|to|–)?\s*(?:\d{1,2})?\s*year(?:s)?\b[^.;!?]{0,40}?experience`)

	// Cohort language that signals a new-grad program even with no year attached.
	cohortLanguagePattern = regexp.MustCompile(`(?i)new grad|new college grad|university grad|campus hire|campus recruit|recent graduate|graduating (student|senior)|early career program|rotational program|class of`)

	internPattern = regexp.MustCompile(`(?i)\bintern\b|internship|\bco-?op\b`)

	seniorTitlePattern = regexp.MustCompile(`(?i)\bsenior\b|\bsr\.?\b|\bstaff\b|\bprincipal\b|\blead engineer\b|\bdirector\b|\bmanager\b|\barchitect\b`)

	// Junior/level-1 titles: real entry-level work, but not proof of a cohort gate.
	entryTitlePattern = regexp.MustCompile(`(?i)\bjunior\b|\bjr\.?\b|\bentry[- ]level\b|\bearly career\b|\bassociate\b|\bgraduate (engineer|developer|analyst)\b|\b(engineer|developer|programmer)\s*(i|1)\b|\bl(evel)?\s*1\b`)

	sentenceSplitter = regexp.MustCompile(`[.;!?\n\r]|(?:\s[•\x{2022}\x{2023}\x{25AA}\-]\s)`)

	// Aggregator repo names glue a year straight onto a word ("Summer2027"),
	// which has no \b boundary for yearPattern to latch onto. Split it before
	// treating the repo name like any other short, deliberate source of years.
	letterDigitBoundary = regexp.MustCompile(`([A-Za-z])(\d)`)
)

// ExtractGradWindow pulls a graduation-eligibility window out of a posting.
//
// Rather than enumerating every phrasing companies use, it harvests years only from
// sentences that already talk about graduating or a degree, then takes the span of
// those years. That handles "class of 2027", "graduating between December 2026 and
// June 2027", and "expected graduation date: Spring 2027" with one rule instead of
// three brittle ones.
//
// The source URL is scanned too: ATS slugs frequently carry the cohort even when the
// posting body does not (e.g. ".../XMLNAME-2027-Software-Engineer--New-College-Grad").
//
// aggregatorRepo is the "owner/repo" a posting was parsed from when it came from a
// curated new-grad/intern aggregator README ("vanshb03/New-Grad-2027",
// "SimplifyJobs/Summer2027-Internships"). Those repos are hand-curated for a single
// cohort year, so a year baked into the repo name is as trustworthy as one in the
// title even when the posting's own thin, synthesized description says nothing about
// graduation at all. Pass "" for postings that did not come from an aggregator.
func ExtractGradWindow(title, description, sourceURL, aggregatorRepo string) (yearMin, yearMax int, relative bool, evidence string) {
	years := map[int]struct{}{}

	consider := func(text string, requireContext bool) {
		for _, sentence := range splitSentences(text) {
			if strings.TrimSpace(sentence) == "" {
				continue
			}
			if yearNoisePattern.MatchString(sentence) {
				continue
			}
			if requireContext && !gradContextPattern.MatchString(sentence) {
				continue
			}
			found := yearPattern.FindAllStringSubmatch(sentence, -1)
			if len(found) == 0 {
				continue
			}
			hit := false
			for _, m := range found {
				year, err := strconv.Atoi(m[1])
				if err != nil || year < minPlausibleGradYear || year > maxPlausibleGradYear {
					continue
				}
				years[year] = struct{}{}
				hit = true
			}
			if hit && evidence == "" {
				evidence = strings.Join(strings.Fields(sentence), " ")
			}
		}
	}

	// Titles and ATS slugs are short and deliberate — a year in one is almost always
	// the cohort ("2027 Software Engineer, New College Grad"), so no surrounding grad
	// context is required. Description text is long and full of incidental years, so
	// there we only harvest from sentences already talking about graduating.
	consider(title, false)
	consider(description, true)
	consider(urlToWords(sourceURL), false)
	consider(repoToWords(aggregatorRepo), false)

	for year := range years {
		if yearMin == 0 || year < yearMin {
			yearMin = year
		}
		if year > yearMax {
			yearMax = year
		}
	}

	if yearMin == 0 {
		if match := relativeGradPattern.FindString(description); match != "" {
			return 0, 0, true, strings.Join(strings.Fields(match), " ")
		}
	}

	return yearMin, yearMax, false, evidence
}

// MinYearsExperience returns the smallest "N years of experience" requirement stated
// in the description, or -1 if none is stated. A posting asking for 2+ years is not
// gated on a graduation cohort no matter how junior the title sounds.
func MinYearsExperience(description string) int {
	matches := yearsExperiencePattern.FindAllStringSubmatch(description, -1)
	minYears := -1
	for _, m := range matches {
		years, err := strconv.Atoi(m[1])
		if err != nil || years < 0 || years > 30 {
			continue
		}
		if minYears == -1 || years < minYears {
			minYears = years
		}
	}
	return minYears
}

// ClassifyGradCohort is the deterministic pass. It returns a verdict with
// Source == GradSourceRegex when it is confident, and Source == GradSourceNone when
// the posting is ambiguous enough to be worth escalating to the LLM pass.
func ClassifyGradCohort(title, description, sourceURL, aggregatorRepo string) GradClassification {
	result := GradClassification{
		EntryType:          EntryTypeUnknown,
		MinYearsExperience: MinYearsExperience(description),
		Source:             GradSourceNone,
	}

	if internPattern.MatchString(title) {
		result.EntryType = EntryTypeIntern
		result.Source = GradSourceRegex
		result.Confidence = 0.95
		return result
	}

	if seniorTitlePattern.MatchString(title) {
		result.EntryType = EntryTypeExperienced
		result.Source = GradSourceRegex
		result.Confidence = 0.95
		return result
	}

	yearMin, yearMax, relative, evidence := ExtractGradWindow(title, description, sourceURL, aggregatorRepo)
	result.YearMin = yearMin
	result.YearMax = yearMax
	result.RelativeWindow = relative
	result.Evidence = evidence

	// An explicit graduation window is the strongest signal there is — a posting only
	// states one when it is genuinely cohort-gated.
	if yearMin != 0 || relative {
		result.EntryType = EntryTypeNewGradCohort
		result.Source = GradSourceRegex
		result.Confidence = 0.9
		return result
	}

	hasCohortLanguage := cohortLanguagePattern.MatchString(title) ||
		cohortLanguagePattern.MatchString(description) ||
		cohortLanguagePattern.MatchString(repoToWords(aggregatorRepo))

	// Cohort program language with no year: still a new-grad req, we just don't know
	// which class. Undated, but not open to everyone.
	if hasCohortLanguage && result.MinYearsExperience <= 0 {
		result.EntryType = EntryTypeNewGradCohort
		result.Source = GradSourceRegex
		result.Confidence = 0.6
		if result.Evidence == "" {
			result.Evidence = firstMatchingSentence(description, cohortLanguagePattern)
		}
		if result.Evidence == "" && aggregatorRepo != "" {
			result.Evidence = "listed in aggregator " + aggregatorRepo
		}
		return result
	}

	// Asks for real years of experience — whatever the title says, this is not a
	// graduating-class req.
	if result.MinYearsExperience >= 2 {
		result.EntryType = EntryTypeExperienced
		result.Source = GradSourceRegex
		result.Confidence = 0.8
		return result
	}

	// This is the case the user keeps hitting: "Software Engineer 1", "Associate
	// Software Engineer", "Early Career" — junior work, immediate start, no cohort
	// gate. Real entry level, but not a 2027 new grad role.
	if entryTitlePattern.MatchString(title) {
		result.EntryType = EntryTypeEntryLevelOpen
		// Only confident when there was enough description to rule a cohort gate out.
		if len(description) >= 400 {
			result.Source = GradSourceRegex
			result.Confidence = 0.7
		}
		return result
	}

	return result
}

// NeedsLLMReview reports whether the deterministic pass left enough doubt to justify
// spending a model call on the posting.
func NeedsLLMReview(c GradClassification, description string) bool {
	if c.Source == GradSourceRegex && c.Confidence >= 0.85 {
		return false
	}
	// Nothing to reason over — an LLM would be guessing from the title alone, which
	// is exactly what the keyword classifier already did for free.
	if len(strings.TrimSpace(description)) < 400 {
		return false
	}
	return c.EntryType == EntryTypeUnknown ||
		c.EntryType == EntryTypeEntryLevelOpen ||
		(c.EntryType == EntryTypeNewGradCohort && c.YearMin == 0)
}

func splitSentences(text string) []string {
	return sentenceSplitter.Split(text, -1)
}

func firstMatchingSentence(text string, pattern *regexp.Regexp) string {
	for _, sentence := range splitSentences(text) {
		if pattern.MatchString(sentence) {
			return strings.Join(strings.Fields(sentence), " ")
		}
	}
	return ""
}

var urlSeparators = regexp.MustCompile(`[-_/+%.?&=]+`)

// urlToWords turns an ATS URL slug into spaced words so the same sentence-level
// rules can run over it.
func urlToWords(sourceURL string) string {
	if sourceURL == "" {
		return ""
	}
	return urlSeparators.ReplaceAllString(sourceURL, " ")
}

// repoToWords does the same as urlToWords for an aggregator "owner/repo" string,
// plus splitting a year glued straight onto a word ("Summer2027" -> "Summer 2027")
// so yearPattern's \b boundaries can find it.
func repoToWords(repo string) string {
	if repo == "" {
		return ""
	}
	spaced := letterDigitBoundary.ReplaceAllString(repo, "$1 $2")
	return urlToWords(spaced)
}
