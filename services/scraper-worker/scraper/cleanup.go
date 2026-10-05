package scraper

import (
	"time"

	"jobdog/scraper-worker/repository"
)

// ClosePastSeasonJobs closes every ACTIVE posting whose title names a hiring
// season that is over. The ingest gate refuses new ones (see IsPastSeason);
// this clears the ones stored before it did, and the ones that crossed over
// since — a "Summer 2026" internship is current in June and stale by
// September while its ATS keeps listing it.
func ClosePastSeasonJobs(repo *repository.JobRepository, now time.Time) (int64, error) {
	candidates, err := repo.ActiveJobsWithYearInTitle()
	if err != nil {
		return 0, err
	}
	var ids []string
	for _, candidate := range candidates {
		if IsPastSeason(candidate.Title, now) {
			ids = append(ids, candidate.ID)
		}
	}
	return repo.CloseJobsByID(ids)
}

// RefreshRoleCategories re-derives every active posting's role category from
// its title, and closes company-board postings whose title is not technical.
//
// A posting's category is computed when it is written, so a posting that is
// merely re-confirmed each cycle keeps whatever the classifier said the day it
// arrived. When the classifier changes (it used to call every unrecognised
// title Software, which put logistics and asset-protection roles in the
// "SWE only" view) this brings what is already stored in line, and keeps it
// there.
func RefreshRoleCategories(repo *repository.JobRepository) (reclassified, closed int64, err error) {
	rows, err := repo.ActiveJobRows()
	if err != nil {
		return 0, 0, err
	}

	byCategory := map[string][]string{}
	var nonTechnical []string
	for _, row := range rows {
		if !isAggregatorSource(row.Source) && !IsTechTitle(row.Title) {
			nonTechnical = append(nonTechnical, row.ID)
			continue
		}
		if category := string(ClassifyRoleCategory(row.Title)); category != row.RoleCategory {
			byCategory[category] = append(byCategory[category], row.ID)
		}
	}

	for category, ids := range byCategory {
		n, err := repo.SetRoleCategory(category, ids)
		if err != nil {
			return reclassified, 0, err
		}
		reclassified += n
	}
	closed, err = repo.CloseJobsByID(nonTechnical)
	return reclassified, closed, err
}

// isAggregatorSource reports whether a stored source tag is a community
// aggregator list (see sourceTagForRepo), the one kind of source whose
// postings are kept without a technical title.
func isAggregatorSource(source string) bool {
	return len(source) > 7 && source[:7] == "github-"
}
