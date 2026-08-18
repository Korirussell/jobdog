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

// ClassifyRoleCategory buckets a posting by job function using the title only.
// Descriptions are noisy ("collaborate with Product and Sales") in exactly the
// way titles are not, so — like ClassifyExperienceLevel — this stays
// title-only and defaults to Software whenever nothing else matches. An
// unrecognized or foreign-language title is far more likely to be a software
// role we don't have a pattern for yet than a true false negative, so the
// default has to be inclusive.
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
	default:
		return RoleCategorySoftware
	}
}
