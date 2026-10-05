package scraper

import "regexp"

// RoleCategory buckets a posting by job function, independent of seniority or
// grad-cohort status. It exists so the board can default to "software roles
// only" without dropping data at ingest — every posting still gets stored and
// classified, the category just lets query-time filtering hide the rest.
type RoleCategory string

const (
	RoleCategorySoftware RoleCategory = "SOFTWARE"
	RoleCategoryQuant    RoleCategory = "QUANT_TRADING"
	RoleCategoryHardware RoleCategory = "HARDWARE"
	RoleCategoryProduct  RoleCategory = "PRODUCT_MANAGEMENT"
	RoleCategorySales    RoleCategory = "SALES"
	RoleCategoryOther    RoleCategory = "OTHER"
)

var (
	// Quant/trading desks title themselves distinctively enough that title alone
	// settles it — "Quantitative Developer" writes real software but the role is
	// desk-aligned, comp-structured, and interview-pathed nothing like a SWE req.
	quantTradingTitlePattern = regexp.MustCompile(`(?i)\bquant(itative)?\s*(trader|researcher|developer|analyst|strategist)\b|\balgorithmic\s*trad|\btrading\s*(strategist|analyst)\b|\bportfolio\s*manager\b`)

	// Hardware/EE titles. "Software Engineer, Embedded" stays software — only
	// flag titles with no ambiguity about which discipline owns the req.
	hardwareTitlePattern = regexp.MustCompile(`(?i)\bhardware\s*engineer\b|\belectrical\s*engineer\b|\basic\s*(design|verification)\s*engineer\b|\bfpga\s*engineer\b|\brf\s*engineer\b|\bmechanical\s*engineer\b|\bpcb\s*(design|layout)\b|\bsilicon\s*engineer\b`)

	productTitlePattern = regexp.MustCompile(`(?i)\bproduct\s*manager\b|\bproduct\s*owner\b|\btechnical\s*program\s*manager\b|\bprogram\s*manager\b|\bproject\s*manager\b`)

	salesTitlePattern = regexp.MustCompile(`(?i)\baccount\s*(executive|manager)\b|\bsales\s*(development|engineer|representative|manager)\b|\bbusiness\s*development\b|\bcustomer\s*success\b|\bsolutions?\s*consultant\b`)
)

// softwareTitlePattern is what a software role's title has to say. Deliberately
// narrower than techTitlePattern: "Engineer" alone, "Systems Engineer",
// "Analytics Intern" and "Manufacturing Engineer I" are technical titles that
// are not software.
var softwareTitlePattern = regexp.MustCompile(`(?i)\b(software|swe|sde|sdet|developer|programmer|devops|sre|site reliability|full[- ]?stack|front[- ]?end|back[- ]?end|mobile|ios|android|web|firmware|embedded|machine learning|ml|ai|data (engineer|scientist|platform)|cloud|platform|infrastructure|cybersecurity|(application|product|network|information) security|security (engineer|software)|research (scientist|engineer)|applied scientist|qa|test automation|computer (science|vision|graphics)|application development|information technology|technology development)\b`)

// ClassifyRoleCategory buckets a posting by job function using the title only.
// Descriptions are noisy ("collaborate with Product and Sales") in exactly the
// way titles are not, so — like ClassifyExperienceLevel — this stays
// title-only.
//
// It used to default to Software when nothing else matched, on the reasoning
// that an unrecognised title was more likely a software role we lacked a
// pattern for than anything else. Measured on the live board that reasoning
// was wrong: 61% of what the "SWE only" default showed was logistics, asset
// protection, manufacturing, financial analysis and communications. Software
// now has to say so; anything else is Other, still one toggle away under "All
// roles".
func ClassifyRoleCategory(title string) RoleCategory {
	switch {
	case quantTradingTitlePattern.MatchString(title):
		return RoleCategoryQuant
	case hardwareTitlePattern.MatchString(title):
		return RoleCategoryHardware
	case productTitlePattern.MatchString(title):
		return RoleCategoryProduct
	case salesTitlePattern.MatchString(title):
		return RoleCategorySales
	case softwareTitlePattern.MatchString(title):
		return RoleCategorySoftware
	default:
		return RoleCategoryOther
	}
}
