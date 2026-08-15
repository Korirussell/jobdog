package scraper

import (
	"net/url"
	"regexp"
	"sort"
	"strings"

	"jobdog/scraper-worker/models"
)

// Board is an applicant-tracking-system job board discovered from an aggregator
// listing. The identifiers here are the only inputs the corresponding ATS API
// needs, which is what makes discovery worthwhile: one link in a README is enough
// to start polling that company's board directly, and from then on we see every
// role they post rather than only the ones an aggregator happened to list.
type Board struct {
	Platform string `json:"platform"`
	Company  string `json:"company"`

	// Token is the board identifier for Greenhouse, Lever, and Ashby.
	Token string `json:"token,omitempty"`

	// Workday needs all three parts; the datacenter is assigned per customer and
	// cannot be derived from the tenant name.
	Tenant     string `json:"tenant,omitempty"`
	Datacenter string `json:"datacenter,omitempty"`
	Site       string `json:"site,omitempty"`
}

// Supported ATS platforms.
const (
	PlatformGreenhouse = "greenhouse"
	PlatformLever      = "lever"
	PlatformWorkday    = "workday"
	PlatformAshby      = "ashby"
)

var (
	// Greenhouse serves boards from two hostnames; job-boards.greenhouse.io is
	// the current one and boards.greenhouse.io is the legacy host still widely
	// linked. Both use the same board token.
	greenhousePattern = regexp.MustCompile(`^(?:job-boards|boards)\.greenhouse\.io$`)
	leverPattern      = regexp.MustCompile(`^jobs\.lever\.co$`)
	ashbyPattern      = regexp.MustCompile(`^jobs\.ashbyhq\.com$`)
	workdayPattern    = regexp.MustCompile(`^([a-z0-9-]+)\.(wd[0-9]+)\.myworkdayjobs\.com$`)

	// Path segments that are never a board identifier.
	reservedSegments = map[string]struct{}{
		"":         {},
		"embed":    {},
		"job":      {},
		"jobs":     {},
		"careers":  {},
		"apply":    {},
		"search":   {},
		"login":    {},
		"wday":     {},
		"en-us":    {},
		"en-US":    {},
		"?":        {},
		"index":    {},
		"postings": {},
	}
)

// ClassifyATSURL maps an apply URL to the board that serves it. It returns false
// for anything not on a supported ATS — bespoke company career sites are
// deliberately out of scope, since each would need its own parser.
func ClassifyATSURL(rawURL string) (Board, bool) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Host == "" {
		return Board{}, false
	}

	host := strings.ToLower(parsed.Host)
	segments := pathSegments(parsed.Path)

	switch {
	case greenhousePattern.MatchString(host):
		// https://job-boards.greenhouse.io/{token}[/jobs/{id}]
		// Some links route through /embed/job_board?for={token}.
		if token := parsed.Query().Get("for"); token != "" {
			return Board{Platform: PlatformGreenhouse, Token: token}, true
		}
		if token, ok := firstUsableSegment(segments); ok {
			return Board{Platform: PlatformGreenhouse, Token: token}, true
		}

	case leverPattern.MatchString(host):
		// https://jobs.lever.co/{slug}[/{job-uuid}]
		if token, ok := firstUsableSegment(segments); ok {
			return Board{Platform: PlatformLever, Token: token}, true
		}

	case ashbyPattern.MatchString(host):
		// https://jobs.ashbyhq.com/{org}[/{job-uuid}]
		if token, ok := firstUsableSegment(segments); ok {
			return Board{Platform: PlatformAshby, Token: token}, true
		}

	default:
		// https://{tenant}.{dc}.myworkdayjobs.com/{site}/job/{location}/{slug}
		if m := workdayPattern.FindStringSubmatch(host); m != nil {
			site, ok := workdaySiteSegment(segments)
			if !ok {
				return Board{}, false
			}
			return Board{
				Platform:   PlatformWorkday,
				Tenant:     m[1],
				Datacenter: m[2],
				Site:       site,
			}, true
		}
	}

	return Board{}, false
}

// workdaySiteSegment picks the site name out of a Workday careers path. Some
// tenants prefix it with a locale segment (…/en-US/CareerSite/job/…), so a
// reserved-looking first segment is skipped rather than treated as the site.
func workdaySiteSegment(segments []string) (string, bool) {
	for _, segment := range segments {
		if segment == "job" {
			// Reached the job path without finding a site name.
			return "", false
		}
		if _, reserved := reservedSegments[strings.ToLower(segment)]; reserved {
			continue
		}
		return segment, true
	}
	return "", false
}

func firstUsableSegment(segments []string) (string, bool) {
	for _, segment := range segments {
		if _, reserved := reservedSegments[strings.ToLower(segment)]; reserved {
			continue
		}
		return segment, true
	}
	return "", false
}

func pathSegments(path string) []string {
	var out []string
	for _, segment := range strings.Split(path, "/") {
		if segment != "" {
			out = append(out, segment)
		}
	}
	return out
}

// DiscoverBoards extracts the distinct ATS boards referenced by a set of scraped
// aggregator rows. Company names come from the aggregator's own table, since an
// ATS token is a slug ("andurilindustries") rather than a display name.
//
// The result is sorted so repeated runs over unchanged input produce identical
// output — the generated config is committed, and a churning diff would make
// real changes hard to review.
func DiscoverBoards(jobs []models.Job) []Board {
	byKey := map[string]Board{}

	for _, job := range jobs {
		board, ok := ClassifyATSURL(job.SourceURL)
		if !ok {
			continue
		}

		company := strings.TrimSpace(job.Company)
		if company == "" {
			continue
		}
		board.Company = company

		key := boardKey(board)
		// Keep the first company name seen for a board. Aggregators sometimes list
		// the same board under a parent and a subsidiary name; picking one
		// deterministically beats letting row order decide.
		if existing, seen := byKey[key]; seen {
			if existing.Company <= company {
				continue
			}
		}
		byKey[key] = board
	}

	boards := make([]Board, 0, len(byKey))
	for _, board := range byKey {
		boards = append(boards, board)
	}
	sort.Slice(boards, func(i, j int) bool {
		if boards[i].Platform != boards[j].Platform {
			return boards[i].Platform < boards[j].Platform
		}
		return boardKey(boards[i]) < boardKey(boards[j])
	})
	return boards
}

// BoardKey exposes the board's dedup key to callers outside this package —
// notably main.go, which needs to check a freshly discovered board against
// the boards it already has configured before deciding to poll it.
func BoardKey(b Board) string {
	return boardKey(b)
}

func boardKey(b Board) string {
	if b.Platform == PlatformWorkday {
		return strings.Join([]string{b.Platform, b.Tenant, b.Datacenter, b.Site}, "|")
	}
	return b.Platform + "|" + strings.ToLower(b.Token)
}
