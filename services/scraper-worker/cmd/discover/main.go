// Command discover expands the scrape config by harvesting ATS job boards from
// the community aggregator repos.
//
// Every aggregator row links to a real applicant-tracking-system URL, and the
// identifier in that URL is the only input the ATS API needs. So instead of
// hand-maintaining a company list, we derive it: extract the boards an
// aggregator references, probe each one, and keep the ones that answer with
// postings. From then on we poll those boards directly and see every role the
// company publishes — not just the subset an aggregator happened to list.
//
// This is a deliberate offline step rather than something the worker does at
// runtime. The generated config is committed, so board additions and removals
// show up in review instead of changing silently in production.
//
//	go run ./cmd/discover                 # report what would change
//	go run ./cmd/discover -write          # merge results into config/sources.json
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"jobdog/scraper-worker/config"
	"jobdog/scraper-worker/models"
	"jobdog/scraper-worker/scraper"
)

func main() {
	var (
		sourcesPath = flag.String("sources", "config/sources.json", "path to sources.json")
		write       = flag.Bool("write", false, "write results back to sources.json (default is a dry run)")
		skipProbe   = flag.Bool("skip-validation", false, "skip live API probing (faster, but ships unverified boards)")
		timeout     = flag.Duration("timeout", 10*time.Minute, "overall timeout")
	)
	flag.Parse()

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	if err := run(ctx, *sourcesPath, *write, *skipProbe); err != nil {
		fmt.Fprintf(os.Stderr, "discover: %v\n", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, sourcesPath string, write, skipProbe bool) error {
	existing, err := readSources(sourcesPath)
	if err != nil {
		return err
	}

	if len(existing.Aggregators) == 0 {
		return fmt.Errorf("no aggregators configured in %s; nothing to discover from", sourcesPath)
	}

	// 1. Harvest candidate boards from every configured aggregator.
	var jobs []models.Job
	for _, agg := range existing.Aggregators {
		readme, err := fetchReadme(ctx, agg.Repo)
		if err != nil {
			fmt.Fprintf(os.Stderr, "  warning: %s: %v\n", agg.Repo, err)
			continue
		}
		parsed := scraper.ParseAggregatorReadme(readme, agg.EmploymentType, agg.Repo)
		fmt.Printf("  %-46s %5d rows\n", agg.Repo, len(parsed))
		jobs = append(jobs, parsed...)
	}

	discovered := scraper.DiscoverBoards(jobs)
	fmt.Printf("\nDiscovered %d distinct boards from %d rows.\n", len(discovered), len(jobs))

	// 2. Keep only the boards we don't already have.
	known := knownBoardKeys(existing)
	var candidates []scraper.Board
	for _, board := range discovered {
		if _, have := known[boardKey(board)]; have {
			continue
		}
		candidates = append(candidates, board)
	}
	fmt.Printf("%d are new (%d already configured).\n\n", len(candidates), len(discovered)-len(candidates))

	if len(candidates) == 0 {
		fmt.Println("Nothing to add.")
		return nil
	}

	// 3. Probe each one. A board that 404s or answers with zero postings is a bad
	//    identifier, and shipping it would create a source that looks healthy in
	//    logs while importing nothing.
	accepted := candidates
	if !skipProbe {
		fmt.Printf("Probing %d boards against their live APIs...\n", len(candidates))
		results := scraper.NewBoardValidator().ValidateAll(ctx, candidates)

		accepted = accepted[:0]
		rejected := 0
		for _, result := range results {
			if result.Valid() {
				accepted = append(accepted, result.Board)
				continue
			}
			rejected++
			reason := "0 postings"
			if result.Err != nil {
				reason = result.Err.Error()
			}
			fmt.Printf("  reject  %-11s %-28s %s\n", result.Board.Platform, boardLabel(result.Board), reason)
		}
		fmt.Printf("\n%d accepted, %d rejected.\n", len(accepted), rejected)
	}

	if len(accepted) == 0 {
		fmt.Println("No boards survived validation; leaving config unchanged.")
		return nil
	}

	merged := mergeBoards(existing, accepted)
	summarize(existing, merged)

	if !write {
		fmt.Printf("\nDry run. Re-run with -write to apply.\n")
		return nil
	}

	if err := writeSources(sourcesPath, merged); err != nil {
		return err
	}
	fmt.Printf("\nWrote %s\n", sourcesPath)
	return nil
}

func fetchReadme(ctx context.Context, repo string) (string, error) {
	client := &http.Client{Timeout: 60 * time.Second}
	var lastErr error

	for _, branch := range []string{"dev", "master", "main"} {
		url := fmt.Sprintf("https://raw.githubusercontent.com/%s/%s/README.md", repo, branch)
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return "", err
		}
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		body, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("branch %s: status %d", branch, resp.StatusCode)
			continue
		}
		if readErr != nil {
			lastErr = readErr
			continue
		}
		return string(body), nil
	}
	return "", fmt.Errorf("could not fetch README: %w", lastErr)
}

// sourcesDocument mirrors sources.json. It is defined here rather than reusing
// the config package's unexported type so the command can round-trip the file
// without changing that package's API.
type sourcesDocument struct {
	Greenhouse  []config.GreenhouseSource `json:"greenhouse"`
	Lever       []config.LeverSource      `json:"lever"`
	Workday     []config.WorkdaySource    `json:"workday"`
	Ashby       []config.AshbySource      `json:"ashby"`
	Aggregators []config.AggregatorSource `json:"aggregators"`
}

func readSources(path string) (*sourcesDocument, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", path, err)
	}
	var doc sourcesDocument
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", path, err)
	}
	return &doc, nil
}

func writeSources(path string, doc *sourcesDocument) error {
	data, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
}

func knownBoardKeys(doc *sourcesDocument) map[string]struct{} {
	keys := map[string]struct{}{}
	for _, s := range doc.Greenhouse {
		keys[scraper.PlatformGreenhouse+"|"+strings.ToLower(s.BoardToken)] = struct{}{}
	}
	for _, s := range doc.Lever {
		keys[scraper.PlatformLever+"|"+strings.ToLower(s.Slug)] = struct{}{}
	}
	for _, s := range doc.Ashby {
		keys[scraper.PlatformAshby+"|"+strings.ToLower(s.Token)] = struct{}{}
	}
	for _, s := range doc.Workday {
		keys[strings.Join([]string{scraper.PlatformWorkday, s.Tenant, s.Datacenter, s.Site}, "|")] = struct{}{}
	}
	return keys
}

func boardKey(b scraper.Board) string {
	if b.Platform == scraper.PlatformWorkday {
		return strings.Join([]string{b.Platform, b.Tenant, b.Datacenter, b.Site}, "|")
	}
	return b.Platform + "|" + strings.ToLower(b.Token)
}

func boardLabel(b scraper.Board) string {
	if b.Platform == scraper.PlatformWorkday {
		return fmt.Sprintf("%s.%s/%s", b.Tenant, b.Datacenter, b.Site)
	}
	return b.Token
}

func mergeBoards(doc *sourcesDocument, boards []scraper.Board) *sourcesDocument {
	merged := *doc
	for _, b := range boards {
		switch b.Platform {
		case scraper.PlatformGreenhouse:
			merged.Greenhouse = append(merged.Greenhouse, config.GreenhouseSource{Company: b.Company, BoardToken: b.Token})
		case scraper.PlatformLever:
			merged.Lever = append(merged.Lever, config.LeverSource{Company: b.Company, Slug: b.Token})
		case scraper.PlatformAshby:
			merged.Ashby = append(merged.Ashby, config.AshbySource{Company: b.Company, Token: b.Token})
		case scraper.PlatformWorkday:
			merged.Workday = append(merged.Workday, config.WorkdaySource{
				Company: b.Company, Tenant: b.Tenant, Datacenter: b.Datacenter, Site: b.Site,
			})
		}
	}

	// Sort by company so the committed file stays reviewable as it grows.
	sort.Slice(merged.Greenhouse, func(i, j int) bool { return merged.Greenhouse[i].Company < merged.Greenhouse[j].Company })
	sort.Slice(merged.Lever, func(i, j int) bool { return merged.Lever[i].Company < merged.Lever[j].Company })
	sort.Slice(merged.Ashby, func(i, j int) bool { return merged.Ashby[i].Company < merged.Ashby[j].Company })
	sort.Slice(merged.Workday, func(i, j int) bool { return merged.Workday[i].Company < merged.Workday[j].Company })
	return &merged
}

func summarize(before, after *sourcesDocument) {
	fmt.Println()
	fmt.Printf("%-12s %8s %8s\n", "platform", "before", "after")
	for _, row := range []struct {
		name          string
		before, after int
	}{
		{"greenhouse", len(before.Greenhouse), len(after.Greenhouse)},
		{"lever", len(before.Lever), len(after.Lever)},
		{"workday", len(before.Workday), len(after.Workday)},
		{"ashby", len(before.Ashby), len(after.Ashby)},
	} {
		fmt.Printf("%-12s %8d %8d\n", row.name, row.before, row.after)
	}
	total := func(d *sourcesDocument) int {
		return len(d.Greenhouse) + len(d.Lever) + len(d.Workday) + len(d.Ashby)
	}
	fmt.Printf("%-12s %8d %8d\n", "TOTAL", total(before), total(after))
}
