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
