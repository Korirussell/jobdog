package scraper

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEligibilityExcerpt(t *testing.T) {
	t.Run("keeps only eligibility sentences", func(t *testing.T) {
		description := "We are a fast growing team building payments infrastructure. " +
			"You must be graduating with a Bachelor's degree between December 2026 and August 2027. " +
			"We offer competitive pay and unlimited PTO. " +
			"Free lunch and a dog-friendly office."

		got := EligibilityExcerpt(description)

		if !strings.Contains(got, "December 2026") {
			t.Errorf("dropped the graduation sentence: %q", got)
		}
		if strings.Contains(got, "dog-friendly") || strings.Contains(got, "unlimited PTO") {
			t.Errorf("kept irrelevant benefits text: %q", got)
		}
	})

	t.Run("returns empty when nothing is relevant", func(t *testing.T) {
		// Signals "don't spend a model call" — there is nothing here to reason over.
		if got := EligibilityExcerpt("Join our team. We build great products. Free snacks."); got != "" {
			t.Errorf("expected empty excerpt, got %q", got)
		}
		if got := EligibilityExcerpt(""); got != "" {
			t.Errorf("expected empty excerpt for empty input, got %q", got)
		}
	})

	t.Run("respects the size budget without truncating mid-sentence", func(t *testing.T) {
		long := strings.Repeat("You must have graduated recently to be eligible for this requirement. ", 200)
		got := EligibilityExcerpt(long)

		if len(got) > maxExcerptChars {
			t.Errorf("excerpt is %d chars, over the %d budget", len(got), maxExcerptChars)
		}
		// A half sentence can invert its meaning, so the tail must be a whole one.
		if strings.HasSuffix(got, "must have") || strings.HasSuffix(got, "graduated") {
			t.Errorf("excerpt was truncated mid-sentence: %q", got[max(0, len(got)-60):])
		}
	})
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func TestVerdictToClassification(t *testing.T) {
	year := func(y int) *int { return &y }

	cases := []struct {
		name     string
		verdict  gradVerdict
		wantType EntryType
		wantMin  int
		wantMax  int
	}{
		{
			name:     "cohort with a full window",
			verdict:  gradVerdict{EntryType: "NEW_GRAD_COHORT", GradYearMin: year(2026), GradYearMax: year(2027), Confidence: 0.9},
			wantType: EntryTypeNewGradCohort, wantMin: 2026, wantMax: 2027,
		},
		{
			name:     "a single stated year is a one-year cohort",
			verdict:  gradVerdict{EntryType: "NEW_GRAD_COHORT", GradYearMin: year(2027), Confidence: 0.8},
			wantType: EntryTypeNewGradCohort, wantMin: 2027, wantMax: 2027,
		},
		{
			name:     "reversed years are corrected",
			verdict:  gradVerdict{EntryType: "NEW_GRAD_COHORT", GradYearMin: year(2027), GradYearMax: year(2026)},
			wantType: EntryTypeNewGradCohort, wantMin: 2026, wantMax: 2027,
		},
		{
			name:     "implausible years are discarded",
			verdict:  gradVerdict{EntryType: "NEW_GRAD_COHORT", GradYearMin: year(1999), GradYearMax: year(2099)},
			wantType: EntryTypeNewGradCohort, wantMin: 0, wantMax: 0,
		},
		{
			// A year on a non-cohort verdict means the model matched a date in the
			// text rather than reading an eligibility window.
			name:     "years are ignored on a non-cohort verdict",
			verdict:  gradVerdict{EntryType: "ENTRY_LEVEL_OPEN", GradYearMin: year(2027), GradYearMax: year(2027)},
			wantType: EntryTypeEntryLevelOpen, wantMin: 0, wantMax: 0,
		},
		{
			name:     "unrecognized entry type falls back to unknown",
			verdict:  gradVerdict{EntryType: "SOMETHING_ELSE"},
			wantType: EntryTypeUnknown,
		},
		{
			name:     "entry type is case-insensitive",
			verdict:  gradVerdict{EntryType: "intern"},
			wantType: EntryTypeIntern,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := verdictToClassification(tc.verdict)
			if got.EntryType != tc.wantType {
				t.Errorf("EntryType = %q, want %q", got.EntryType, tc.wantType)
			}
			if got.YearMin != tc.wantMin || got.YearMax != tc.wantMax {
				t.Errorf("years = (%d, %d), want (%d, %d)", got.YearMin, got.YearMax, tc.wantMin, tc.wantMax)
			}
			if got.Source != GradSourceLLM {
				t.Errorf("Source = %q, want %q", got.Source, GradSourceLLM)
			}
		})
	}

	t.Run("confidence is clamped to 0..1", func(t *testing.T) {
		if got := verdictToClassification(gradVerdict{EntryType: "INTERN", Confidence: 4.2}); got.Confidence != 1 {
			t.Errorf("confidence = %v, want 1", got.Confidence)
		}
		if got := verdictToClassification(gradVerdict{EntryType: "INTERN", Confidence: -1}); got.Confidence != 0 {
			t.Errorf("confidence = %v, want 0", got.Confidence)
		}
	})
}

func TestClassifierSkipsCallsThatCannotHelp(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Write([]byte(`{"choices":[{"message":{"content":"{\"entry_type\":\"INTERN\"}"}}]}`))
	}))
	defer server.Close()

	t.Run("no API key means no call", func(t *testing.T) {
		c := NewGradYearClassifier(GradYearClassifierConfig{Endpoint: server.URL})
		_, ok, err := c.Classify(context.Background(), "Engineer", "must graduate in 2027")
		if ok || err != nil {
			t.Errorf("ok=%v err=%v, want false/nil", ok, err)
		}
		if calls != 0 {
			t.Errorf("made %d calls without an API key, want 0", calls)
		}
	})

	t.Run("a description with no eligibility language is not sent", func(t *testing.T) {
		calls = 0
		c := NewGradYearClassifier(GradYearClassifierConfig{APIKey: "test", Endpoint: server.URL})
		_, ok, err := c.Classify(context.Background(), "Engineer", "We build products. Free snacks.")
		if ok || err != nil {
			t.Errorf("ok=%v err=%v, want false/nil", ok, err)
		}
		if calls != 0 {
			t.Errorf("made %d calls for an excerpt-less description, want 0", calls)
		}
	})
}

func TestClassifySendsOnlyTheExcerpt(t *testing.T) {
	var received openAIRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&received)
		w.Write([]byte(`{"choices":[{"message":{"content":"{\"entry_type\":\"NEW_GRAD_COHORT\",\"grad_year_min\":2027,\"grad_year_max\":2027,\"confidence\":0.95,\"evidence\":\"class of 2027\"}"}}]}`))
	}))
	defer server.Close()

	description := "We are a great company with free snacks and a dog-friendly office. " +
		"This role is open to the class of 2027. " +
		"Our office has a ping pong table and cold brew on tap."

	c := NewGradYearClassifier(GradYearClassifierConfig{APIKey: "test", Endpoint: server.URL})
	got, ok, err := c.Classify(context.Background(), "Software Engineer", description)
	if err != nil || !ok {
		t.Fatalf("Classify() ok=%v err=%v", ok, err)
	}

	if got.EntryType != EntryTypeNewGradCohort || got.YearMin != 2027 || got.YearMax != 2027 {
		t.Errorf("got %+v, want NEW_GRAD_COHORT 2027-2027", got)
	}

	// Temperature 0 keeps a posting from drifting between classifications.
	if received.Temperature != 0 {
		t.Errorf("temperature = %v, want 0", received.Temperature)
	}

	userMessage := received.Messages[len(received.Messages)-1].Content
	if !strings.Contains(userMessage, "class of 2027") {
		t.Errorf("prompt lost the relevant sentence: %q", userMessage)
	}
	// The cost lever: irrelevant text must not reach the model.
	if strings.Contains(userMessage, "ping pong") || strings.Contains(userMessage, "dog-friendly") {
		t.Errorf("prompt carried irrelevant text, inflating token cost: %q", userMessage)
	}
}
