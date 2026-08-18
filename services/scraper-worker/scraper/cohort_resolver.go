package scraper

import (
	"context"

	"jobdog/scraper-worker/models"

	"github.com/rs/zerolog/log"
)

// gradCohortStore is the persistence the resolver needs. Declared as an
// interface so the resolver can be tested without a database.
type gradCohortStore interface {
	LookupGradClassification(descriptionHash, model string) (*models.GradClassification, error)
	SaveGradClassification(descriptionHash, model string, c models.GradClassification) error
	UpdateJobGradCohort(jobID string, c models.GradClassification) error
}

// CohortResolver decides which graduation cohort a posting targets and persists
// the answer.
//
// Three tiers, cheapest first:
//
//  1. Deterministic keyword and year extraction. Free, and it settles the
//     majority of postings — anything with an explicit window, an intern title,
//     or a senior title.
//  2. Cached model verdict, keyed on the description hash. A posting is
//     classified once ever, not once per scrape cycle.
//  3. A model call, only for postings the first tier left genuinely ambiguous.
type CohortResolver struct {
	store      gradCohortStore
	classifier *GradYearClassifier
	model      string
}

func NewCohortResolver(store gradCohortStore, classifier *GradYearClassifier) *CohortResolver {
	model := defaultGradModel
	if classifier != nil && classifier.model != "" {
		model = classifier.model
	}
	return &CohortResolver{store: store, classifier: classifier, model: model}
}

// Resolve classifies one posting, writes the verdict to its job row, and
// returns what it settled on (the zero-value EntryTypeUnknown/GradSourceNone
// verdict when there was nothing useful to record) — callers that only need
// the side effect, like every scraper's synchronous path, can ignore it.
//
// Errors are logged rather than returned: a posting that cannot be classified is
// still a posting worth showing, so classification never fails a scrape.
func (r *CohortResolver) Resolve(ctx context.Context, jobID string, job *models.Job) GradClassification {
	if r == nil || r.store == nil {
		return GradClassification{}
	}

	result := ClassifyGradCohort(job.Title, job.DescriptionText, job.SourceURL, job.SourceRepo)

	if NeedsLLMReview(result, job.DescriptionText) {
		if resolved, ok := r.resolveWithModel(ctx, job); ok {
			result = resolved
		}
	}

	if result.EntryType == EntryTypeUnknown && result.Source == GradSourceNone {
		// Nothing useful to record; leave the columns null rather than writing a
		// verdict that claims more certainty than we have.
		return result
	}

	if err := r.store.UpdateJobGradCohort(jobID, toPersisted(result)); err != nil {
		log.Warn().Err(err).Str("job_id", jobID).Msg("Failed to persist grad cohort")
	}

	return result
}

// resolveWithModel consults the cache before spending a call, and writes any new
// verdict back so the next cycle is free.
func (r *CohortResolver) resolveWithModel(ctx context.Context, job *models.Job) (GradClassification, bool) {
	hash := job.DescriptionHash

	if cached, err := r.store.LookupGradClassification(hash, r.model); err != nil {
		log.Warn().Err(err).Msg("Grad classification cache lookup failed; falling through to the model")
	} else if cached != nil {
		return fromPersisted(*cached), true
	}

	if !r.classifier.Enabled() {
		return GradClassification{}, false
	}

	result, ok, err := r.classifier.Classify(ctx, job.Title, job.DescriptionText)
	if err != nil {
		log.Warn().Err(err).Str("title", job.Title).Msg("Grad-year model call failed")
		return GradClassification{}, false
	}
	if !ok {
		return GradClassification{}, false
	}

	if err := r.store.SaveGradClassification(hash, r.model, toPersisted(result)); err != nil {
		// Losing the cache write costs money on the next cycle but not correctness.
		log.Warn().Err(err).Msg("Failed to cache grad classification")
	}
	return result, true
}

func toPersisted(c GradClassification) models.GradClassification {
	return models.GradClassification{
		EntryType:  string(c.EntryType),
		YearMin:    c.YearMin,
		YearMax:    c.YearMax,
		Source:     c.Source,
		Confidence: c.Confidence,
		Evidence:   c.Evidence,
	}
}

func fromPersisted(c models.GradClassification) GradClassification {
	return GradClassification{
		EntryType:          EntryType(c.EntryType),
		YearMin:            c.YearMin,
		YearMax:            c.YearMax,
		Source:             GradSourceLLM,
		Confidence:         c.Confidence,
		Evidence:           c.Evidence,
		MinYearsExperience: -1,
	}
}
