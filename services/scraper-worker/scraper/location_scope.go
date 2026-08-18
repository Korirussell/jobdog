package scraper

import "regexp"

// LocationScope buckets a posting by whether a US-based candidate could
// realistically take it — either it's in the US, or it's remote. Like
// RoleCategory, this stays a query-time filter rather than an ingest-time
// drop: a location string is free text ("Multiple Locations", "EMEA"), so
// classification error is inevitable and the default has to favor keeping
// the posting visible rather than silently disappearing it.
type LocationScope string

const (
	LocationScopeUSOrRemote LocationScope = "US_OR_REMOTE"
	LocationScopeNonUS      LocationScope = "NON_US"
)

var (
	remoteLocationPattern = regexp.MustCompile(`(?i)\bremote\b|\bwork from home\b|\bwfh\b`)

	// Cities/regions frequent enough on ATS boards to name explicitly rather
	// than rely on the ",  XX" state-code heuristic missing them. Not
	// exhaustive — this only needs to catch the common case; anything it
	// misses falls through to the inclusive default.
	nonUSLocationPattern = regexp.MustCompile(`(?i)\b(london|dublin|toronto|vancouver|montreal|berlin|munich|amsterdam|paris|zurich|geneva|singapore|bangalore|bengaluru|hyderabad|mumbai|delhi|pune|tel aviv|sydney|melbourne|tokyo|seoul|shanghai|beijing|hong kong|são paulo|sao paulo|mexico city|warsaw|krakow|lisbon|madrid|barcelona|milan|stockholm|copenhagen|helsinki|oslo|manila|jakarta|kuala lumpur|auckland|wellington)\b|\b(uk|united kingdom|canada|ireland|germany|france|switzerland|india|israel|australia|japan|china|brazil|poland|portugal|spain|italy|sweden|denmark|finland|norway|philippines|indonesia|malaysia|new zealand|netherlands)\b`)
)

// ClassifyLocationScope decides whether a posting's location text is
// compatible with a US-based new-grad job search.
//
// Remote wins outright — a posting can list "Remote (UK)" and still be one a
// US candidate should never see, but "Remote" alongside a US city, or bare
// "Remote", almost always means US-remote on the boards we scrape (US ATS
// tenants), so treat unqualified remote as in-scope. An explicit non-US
// country/city with no remote qualifier is the only case excluded; empty or
// ambiguous location text defaults to in-scope.
func ClassifyLocationScope(location string) LocationScope {
	if location == "" {
		return LocationScopeUSOrRemote
	}
	if remoteLocationPattern.MatchString(location) {
		return LocationScopeUSOrRemote
	}
	if nonUSLocationPattern.MatchString(location) {
		return LocationScopeNonUS
	}
	return LocationScopeUSOrRemote
}
