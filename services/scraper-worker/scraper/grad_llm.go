package scraper

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// GradYearClassifier resolves graduation-cohort eligibility for postings the
// deterministic pass could not settle.
//
// Cost control is structural rather than incidental:
//   - NeedsLLMReview gates which postings get here at all; anything the regex
//     pass resolved confidently never reaches the model.
//   - EligibilityExcerpt sends the handful of relevant sentences instead of the
//     whole description.
//   - Verdicts are cached by description hash, so a posting is classified once
//     ever rather than once per scrape cycle. Without that cache the 2-hourly
//     cron would re-classify the entire active corpus twelve times a day.
type GradYearClassifier struct {
	client   *http.Client
	apiKey   string
	model    string
	endpoint string
}

// GradYearClassifierConfig configures the classifier. Model is configurable so
// the cost/accuracy tradeoff can be tuned without a code change.
type GradYearClassifierConfig struct {
	APIKey   string
	Model    string
	Endpoint string
}

const (
	defaultGradModel    = "gpt-4o-mini"
	defaultGradEndpoint = "https://api.openai.com/v1/chat/completions"
)

func NewGradYearClassifier(cfg GradYearClassifierConfig) *GradYearClassifier {
	model := cfg.Model
	if model == "" {
		model = defaultGradModel
	}
	endpoint := cfg.Endpoint
	if endpoint == "" {
		endpoint = defaultGradEndpoint
	}
	return &GradYearClassifier{
		client:   &http.Client{Timeout: 30 * time.Second},
		apiKey:   cfg.APIKey,
		model:    model,
		endpoint: endpoint,
	}
}

// Enabled reports whether the classifier can run. With no API key configured the
// pipeline keeps working on deterministic classification alone.
func (c *GradYearClassifier) Enabled() bool { return c != nil && c.apiKey != "" }

// gradPrompt asks the one question the regex pass cannot answer: is this posting
// gated on a graduation window, or is it an ordinary junior req that anyone can
// apply to? The distinction is what separates a real 2027 new-grad role from an
// "entry level, start in two months" posting sitting in a new-grad list.
const gradPrompt = `You classify software job postings by graduation-cohort eligibility.

Return ONLY a JSON object with these fields:
{
  "entry_type": "NEW_GRAD_COHORT" | "ENTRY_LEVEL_OPEN" | "INTERN" | "EXPERIENCED" | "UNKNOWN",
  "grad_year_min": integer or null,
  "grad_year_max": integer or null,
  "confidence": number between 0 and 1,
  "evidence": "the exact phrase you based this on, or empty string"
}

Definitions:
- NEW_GRAD_COHORT: eligibility is restricted to people graduating in a stated
  window ("class of 2027", "graduating between Dec 2026 and Aug 2027",
  "must graduate within 12 months of start"). Set grad_year_min/max to the
  calendar years of that window when stated; use null when the posting is
  cohort-gated but names no year.
- ENTRY_LEVEL_OPEN: junior or level-1 role with NO graduation restriction.
  Anyone with roughly 0-3 years can apply and the start is typically immediate.
  This includes "Software Engineer I", "Associate Software Engineer", and
  "Early Career" roles that do not gate on graduation date.
- INTERN: an internship or co-op.
- EXPERIENCED: requires meaningful professional experience (2+ years).
- UNKNOWN: the text genuinely does not say.

The most important distinction is NEW_GRAD_COHORT vs ENTRY_LEVEL_OPEN. Do not
infer a graduation gate from a junior title alone — the posting must actually
restrict by graduation timing. Base grad years only on what the text states;
never guess a year.`

type openAIRequest struct {
	Model          string          `json:"model"`
	Messages       []openAIMessage `json:"messages"`
	Temperature    float64         `json:"temperature"`
	MaxTokens      int             `json:"max_tokens"`
	ResponseFormat map[string]any  `json:"response_format,omitempty"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	Choices []struct {
		Message openAIMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

// gradVerdict is the model's raw answer, before it is folded into a
// GradClassification.
type gradVerdict struct {
	EntryType   string  `json:"entry_type"`
	GradYearMin *int    `json:"grad_year_min"`
	GradYearMax *int    `json:"grad_year_max"`
	Confidence  float64 `json:"confidence"`
	Evidence    string  `json:"evidence"`
}

// Classify asks the model to resolve one posting. It returns the zero value and
// false when there is nothing worth spending a call on.
func (c *GradYearClassifier) Classify(ctx context.Context, title, description string) (GradClassification, bool, error) {
	if !c.Enabled() {
		return GradClassification{}, false, nil
	}

	excerpt := EligibilityExcerpt(description)
	if excerpt == "" {
		// No eligibility language anywhere — the model would be guessing from the
		// title, which the keyword classifier already did for free.
		return GradClassification{}, false, nil
	}

	body, err := json.Marshal(openAIRequest{
		Model: c.model,
		Messages: []openAIMessage{
			{Role: "system", Content: gradPrompt},
			{Role: "user", Content: fmt.Sprintf("Title: %s\n\nRelevant description text:\n%s", title, excerpt)},
		},
		// Deterministic: the same posting must not drift between classifications,
		// and this is extraction rather than generation.
		Temperature:    0,
		MaxTokens:      200,
		ResponseFormat: map[string]any{"type": "json_object"},
	})
	if err != nil {
		return GradClassification{}, false, err
	}

	var verdict gradVerdict
	err = RetryWithBackoff(ctx, 3, "openai:grad-year", func() error {
		req, err := http.NewRequestWithContext(ctx, "POST", c.endpoint, bytes.NewReader(body))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+c.apiKey)

		resp, err := c.client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		var decoded openAIResponse
		if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
			return fmt.Errorf("decoding response (status %d): %w", resp.StatusCode, err)
		}
		if decoded.Error != nil {
			return fmt.Errorf("openai error: %s", decoded.Error.Message)
		}
		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("openai returned status %d", resp.StatusCode)
		}
		if len(decoded.Choices) == 0 {
			return fmt.Errorf("openai returned no choices")
		}

		return json.Unmarshal([]byte(decoded.Choices[0].Message.Content), &verdict)
	})
	if err != nil {
		return GradClassification{}, false, err
	}

	return verdictToClassification(verdict), true, nil
}

// verdictToClassification folds the model's answer into the same shape the
// deterministic pass produces, so downstream code never needs to know which pass
// resolved a posting.
func verdictToClassification(v gradVerdict) GradClassification {
	result := GradClassification{
		EntryType:          normalizeEntryType(v.EntryType),
		Evidence:           strings.TrimSpace(v.Evidence),
		Source:             GradSourceLLM,
		Confidence:         clampConfidence(v.Confidence),
		MinYearsExperience: -1,
	}

	// Only trust years on a cohort verdict. A year attached to any other entry
	// type is the model pattern-matching a date out of the text rather than
	// reading an eligibility window.
	if result.EntryType == EntryTypeNewGradCohort {
		if v.GradYearMin != nil && plausibleGradYear(*v.GradYearMin) {
			result.YearMin = *v.GradYearMin
		}
		if v.GradYearMax != nil && plausibleGradYear(*v.GradYearMax) {
			result.YearMax = *v.GradYearMax
		}
		// A single stated year is a one-year cohort, not an open-ended range.
		if result.YearMin != 0 && result.YearMax == 0 {
			result.YearMax = result.YearMin
		}
		if result.YearMax != 0 && result.YearMin == 0 {
			result.YearMin = result.YearMax
		}
		if result.YearMin != 0 && result.YearMax != 0 && result.YearMin > result.YearMax {
			result.YearMin, result.YearMax = result.YearMax, result.YearMin
		}
	}

	return result
}

func normalizeEntryType(raw string) EntryType {
	switch EntryType(strings.ToUpper(strings.TrimSpace(raw))) {
	case EntryTypeNewGradCohort:
		return EntryTypeNewGradCohort
	case EntryTypeEntryLevelOpen:
		return EntryTypeEntryLevelOpen
	case EntryTypeIntern:
		return EntryTypeIntern
	case EntryTypeExperienced:
		return EntryTypeExperienced
	default:
		return EntryTypeUnknown
	}
}

func plausibleGradYear(year int) bool {
	return year >= minPlausibleGradYear && year <= maxPlausibleGradYear
}

func clampConfidence(c float64) float64 {
	switch {
	case c < 0:
		return 0
	case c > 1:
		return 1
	default:
		return c
	}
}
