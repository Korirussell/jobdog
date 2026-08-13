package scraper

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"jobdog/scraper-worker/models"
)

type fakeStore struct {
	cached     map[string]models.GradClassification
	saved      map[string]models.GradClassification
	updated    map[string]models.GradClassification
	lookupHits int
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		cached:  map[string]models.GradClassification{},
		saved:   map[string]models.GradClassification{},
		updated: map[string]models.GradClassification{},
	}
}

func (f *fakeStore) LookupGradClassification(hash, model string) (*models.GradClassification, error) {
	f.lookupHits++
	if c, ok := f.cached[hash]; ok {
		return &c, nil
	}
	return nil, nil
}

func (f *fakeStore) SaveGradClassification(hash, model string, c models.GradClassification) error {
	f.saved[hash] = c
	return nil
}

func (f *fakeStore) UpdateJobGradCohort(jobID string, c models.GradClassification) error {
	f.updated[jobID] = c
	return nil
}

// substantialDescription clears the length threshold that gates model review.
const substantialDescription = "You will work alongside experienced engineers on production systems serving " +
	"millions of users. Responsibilities include designing, building, testing and shipping backend services, " +
	"participating in code review, and collaborating across product and design. We offer competitive " +
	"compensation, comprehensive health benefits, and a generous learning stipend for every engineer here. " +
	"Our team values thoughtful code review, incremental delivery, and a healthy on-call rotation shared " +
	"fairly across the group, and we invest heavily in mentorship for engineers early in their careers."

func TestResolverSkipsModelWhenDeterministicIsConfident(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Write([]byte(`{"choices":[{"message":{"content":"{\"entry_type\":\"UNKNOWN\"}"}}]}`))
	}))
	defer server.Close()

	store := newFakeStore()
	resolver := NewCohortResolver(store, NewGradYearClassifier(GradYearClassifierConfig{APIKey: "k", Endpoint: server.URL}))

	// An explicit graduation window is settled for free — the model must not run.
	job := &models.Job{
		Title:           "Software Engineer, New Grad",
		DescriptionText: substantialDescription + " You must graduate between December 2026 and August 2027.",
		DescriptionHash: "hash-explicit",
	}
	resolver.Resolve(context.Background(), "job-1", job)

	if calls != 0 {
		t.Errorf("made %d model calls for a deterministically-resolved posting, want 0", calls)
	}
	got := store.updated["job-1"]
	if got.EntryType != string(EntryTypeNewGradCohort) || got.YearMin != 2026 || got.YearMax != 2027 {
		t.Errorf("persisted %+v, want NEW_GRAD_COHORT 2026-2027", got)
	}
	if got.Source != GradSourceRegex {
		t.Errorf("Source = %q, want %q", got.Source, GradSourceRegex)
	}
}

func TestResolverUsesCacheBeforeCallingTheModel(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Write([]byte(`{"choices":[{"message":{"content":"{\"entry_type\":\"UNKNOWN\"}"}}]}`))
	}))
	defer server.Close()

	store := newFakeStore()
	store.cached["hash-seen-before"] = models.GradClassification{
		EntryType: string(EntryTypeNewGradCohort), YearMin: 2027, YearMax: 2027, Confidence: 0.9,
	}

	resolver := NewCohortResolver(store, NewGradYearClassifier(GradYearClassifierConfig{APIKey: "k", Endpoint: server.URL}))
	job := &models.Job{
		Title:           "Software Engineer I",
		DescriptionText: substantialDescription,
		DescriptionHash: "hash-seen-before",
	}
	resolver.Resolve(context.Background(), "job-2", job)

	// This is the property that keeps cost bounded across 12 scrape cycles a day.
	if calls != 0 {
		t.Errorf("made %d model calls despite a cache hit, want 0", calls)
	}
	if got := store.updated["job-2"]; got.YearMin != 2027 {
		t.Errorf("persisted %+v, want the cached 2027 verdict", got)
	}
}

func TestResolverCallsModelOnceThenCachesTheVerdict(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Write([]byte(`{"choices":[{"message":{"content":"{\"entry_type\":\"ENTRY_LEVEL_OPEN\",\"confidence\":0.8,\"evidence\":\"immediate start\"}"}}]}`))
	}))
	defer server.Close()

	store := newFakeStore()
	resolver := NewCohortResolver(store, NewGradYearClassifier(GradYearClassifierConfig{APIKey: "k", Endpoint: server.URL}))

	job := &models.Job{
		Title:           "Software Engineer I",
		DescriptionText: substantialDescription + " Candidates must have a degree; this role has an immediate start date.",
		DescriptionHash: "hash-new",
	}
	resolver.Resolve(context.Background(), "job-3", job)

	if calls != 1 {
		t.Fatalf("made %d model calls, want exactly 1", calls)
	}
	if cached, ok := store.saved["hash-new"]; !ok {
		t.Error("verdict was not cached; the next cycle would pay for it again")
	} else if cached.EntryType != string(EntryTypeEntryLevelOpen) {
		t.Errorf("cached %+v, want ENTRY_LEVEL_OPEN", cached)
	}
	if got := store.updated["job-3"]; got.EntryType != string(EntryTypeEntryLevelOpen) {
		t.Errorf("persisted %+v, want ENTRY_LEVEL_OPEN", got)
	}
}

func TestResolverDegradesWithoutAnAPIKey(t *testing.T) {
	store := newFakeStore()
	// No key: the deterministic pass must still run and persist what it can.
	resolver := NewCohortResolver(store, NewGradYearClassifier(GradYearClassifierConfig{}))

	job := &models.Job{
		Title:           "Software Engineer Intern",
		DescriptionText: substantialDescription,
		DescriptionHash: "hash-nokey",
	}
	resolver.Resolve(context.Background(), "job-4", job)

	if got := store.updated["job-4"]; got.EntryType != string(EntryTypeIntern) {
		t.Errorf("persisted %+v, want INTERN from the deterministic pass", got)
	}
}

func TestResolverWritesNothingWhenItKnowsNothing(t *testing.T) {
	store := newFakeStore()
	resolver := NewCohortResolver(store, NewGradYearClassifier(GradYearClassifierConfig{}))

	// Thin description, ambiguous title, no model available — recording UNKNOWN
	// would overwrite a possibly-better earlier verdict with a non-answer.
	job := &models.Job{Title: "Software Engineer", DescriptionText: "Engineer at Acme", DescriptionHash: "h"}
	resolver.Resolve(context.Background(), "job-5", job)

	if _, wrote := store.updated["job-5"]; wrote {
		t.Error("wrote a verdict despite having nothing to say")
	}
}

func TestResolverToleratesANilStore(t *testing.T) {
	// The scrapers construct a resolver unconditionally; a nil store must be a
	// no-op rather than a panic that takes down a scrape.
	var resolver *CohortResolver
	resolver.Resolve(context.Background(), "job", &models.Job{Title: strings.Repeat("x", 10)})
}
