// Command sourcestats shows what every scraper source is actually
// contributing to the board.
//
// For each source and company it reports how many postings are active, how many
// of those the site would show (internships, new-grad, open entry-level), and
// how many have closed — plus every source in sources.json that has produced
// nothing. The point is to be able to see, and change, what is being scraped:
// a source that is active-but-never-visible is stored and checked for nothing,
// and a configured source with no rows at all is either broken or pointed at
// the wrong board.
//
// Run it inside the worker container, where the database and the config are:
//
//	docker exec jobdog-scraper-worker /app/sourcestats
//	docker exec jobdog-scraper-worker /app/sourcestats -top 40
//
// The source list itself is config/sources.json; edit it and redeploy to add,
// remove or re-point a source.
package main

import (
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"
	"text/tabwriter"
	"time"

	"jobdog/scraper-worker/config"
	"jobdog/scraper-worker/database"
	"jobdog/scraper-worker/repository"
)

func main() {
	top := flag.Int("top", 25, "how many of the biggest contributors to list")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, "config:", err)
		os.Exit(1)
	}
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "database:", err)
		os.Exit(1)
	}
	defer db.Close()

	stats, err := repository.NewJobRepository(db).SourceStats()
	if err != nil {
		fmt.Fprintln(os.Stderr, "stats:", err)
		os.Exit(1)
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)

	// Totals per source type.
	type totals struct{ active, visible, closed, companies int }
	bySource := map[string]*totals{}
	for _, s := range stats {
		t := bySource[s.Source]
		if t == nil {
			t = &totals{}
			bySource[s.Source] = t
		}
		t.active += s.Active
		t.visible += s.Visible
		t.closed += s.Closed
		if s.Active > 0 {
			t.companies++
		}
	}
	names := make([]string, 0, len(bySource))
	for name := range bySource {
		names = append(names, name)
	}
	sort.Slice(names, func(i, j int) bool { return bySource[names[i]].visible > bySource[names[j]].visible })

	fmt.Fprintln(w, "BY SOURCE TYPE")
	fmt.Fprintln(w, "source\tactive\tshown on site\tclosed\tcompanies with active jobs")
	for _, name := range names {
		t := bySource[name]
		fmt.Fprintf(w, "%s\t%d\t%d\t%d\t%d\n", name, t.active, t.visible, t.closed, t.companies)
	}
	fmt.Fprintln(w)

	// Biggest contributors.
	fmt.Fprintf(w, "TOP %d CONTRIBUTORS\n", *top)
	fmt.Fprintln(w, "company\tsource\tshown\tactive\tclosed\tlast seen")
	for i, s := range stats {
		if i >= *top || s.Visible == 0 {
			break
		}
		fmt.Fprintf(w, "%s\t%s\t%d\t%d\t%d\t%s\n", s.Company, s.Source, s.Visible, s.Active, s.Closed, ago(s.LastSeen))
	}
	fmt.Fprintln(w)

	// Dead weight: stored, but never shown.
	var deadWeight []repository.SourceStat
	for _, s := range stats {
		if s.Active > 0 && s.Visible == 0 {
			deadWeight = append(deadWeight, s)
		}
	}
	sort.Slice(deadWeight, func(i, j int) bool { return deadWeight[i].Active > deadWeight[j].Active })
	fmt.Fprintf(w, "ACTIVE BUT NEVER SHOWN (%d companies) — stored and checked for nothing\n", len(deadWeight))
	fmt.Fprintln(w, "company\tsource\tactive")
	for i, s := range deadWeight {
		if i >= *top {
			fmt.Fprintf(w, "... and %d more\t\t\n", len(deadWeight)-i)
			break
		}
		fmt.Fprintf(w, "%s\t%s\t%d\n", s.Company, s.Source, s.Active)
	}
	fmt.Fprintln(w)

	// Configured, but no rows at all.
	have := map[string]bool{}
	for _, s := range stats {
		have[strings.ToLower(s.Company)] = true
	}
	var silent []string
	add := func(kind, company string) {
		if !have[strings.ToLower(company)] {
			silent = append(silent, fmt.Sprintf("%s (%s)", company, kind))
		}
	}
	for _, s := range cfg.GreenhouseSources {
		add("greenhouse", s.Company)
	}
	for _, s := range cfg.LeverSources {
		add("lever", s.Company)
	}
	for _, s := range cfg.AshbySources {
		add("ashby", s.Company)
	}
	for _, s := range cfg.WorkdaySources {
		add("workday/"+s.Site, s.Company)
	}
	sort.Strings(silent)
	fmt.Fprintf(w, "CONFIGURED BUT NO ROWS AT ALL (%d) — broken, wrong board, or nothing early-career there\n", len(silent))
	for _, name := range silent {
		fmt.Fprintln(w, name)
	}
	w.Flush()
}

func ago(t time.Time) string {
	d := time.Since(t)
	switch {
	case d < time.Hour:
		return fmt.Sprintf("%dm ago", int(d.Minutes()))
	case d < 48*time.Hour:
		return fmt.Sprintf("%dh ago", int(d.Hours()))
	default:
		return fmt.Sprintf("%dd ago", int(d.Hours()/24))
	}
}
