package config

import (
	"os"
	"testing"
)

// TestSourcesJSONCoversEmbeddedDefaults guards against sources.json losing
// boards relative to the embedded fallback list.
//
// The embedded defaults are a floor, not a mirror: cmd/discover grows
// sources.json well past them, so an equality check would fail on every
// discovery run. What must hold is that every hand-curated fallback board still
// appears in the generated file — otherwise a regeneration could silently drop
// a company we deliberately added, and the only signal would be that company's
// jobs quietly disappearing from the site.
func TestSourcesJSONCoversEmbeddedDefaults(t *testing.T) {
	t.Setenv("SOURCES_CONFIG_PATH", "sources.json")

	sources := loadSources()

	greenhouse := map[string]struct{}{}
	for _, s := range sources.Greenhouse {
		greenhouse[s.BoardToken] = struct{}{}
	}
	for _, want := range defaultGreenhouseSources {
		if _, ok := greenhouse[want.BoardToken]; !ok {
			t.Errorf("sources.json is missing greenhouse board %q (%s)", want.BoardToken, want.Company)
		}
	}

	lever := map[string]struct{}{}
	for _, s := range sources.Lever {
		lever[s.Slug] = struct{}{}
	}
	for _, want := range defaultLeverSources {
		if _, ok := lever[want.Slug]; !ok {
			t.Errorf("sources.json is missing lever board %q (%s)", want.Slug, want.Company)
		}
	}

	workday := map[string]struct{}{}
	for _, s := range sources.Workday {
		workday[s.Tenant+"|"+s.Datacenter+"|"+s.Site] = struct{}{}
	}
	for _, want := range defaultWorkdaySources {
		if _, ok := workday[want.Tenant+"|"+want.Datacenter+"|"+want.Site]; !ok {
			t.Errorf("sources.json is missing workday tenant %q (%s)", want.Tenant, want.Company)
		}
	}
}

// TestLoadSourcesFallsBackWhenFileMissing ensures a missing/invalid sources
// config does not break the loader and falls back to the embedded defaults.
func TestLoadSourcesFallsBackWhenFileMissing(t *testing.T) {
	t.Setenv("SOURCES_CONFIG_PATH", "does-not-exist.json")

	sources := loadSources()
	greenhouse, lever := sources.Greenhouse, sources.Lever

	if len(greenhouse) != len(defaultGreenhouseSources) {
		t.Errorf("expected fallback greenhouse sources of length %d, got %d",
			len(defaultGreenhouseSources), len(greenhouse))
	}
	if len(lever) != len(defaultLeverSources) {
		t.Errorf("expected fallback lever sources of length %d, got %d",
			len(defaultLeverSources), len(lever))
	}
}

// TestLoadSourcesFallsBackOnInvalidJSON ensures malformed JSON does not
// panic or return an error to the caller; it falls back to defaults.
func TestLoadSourcesFallsBackOnInvalidJSON(t *testing.T) {
	tmpFile := t.TempDir() + "/bad-sources.json"
	if err := os.WriteFile(tmpFile, []byte("{ not valid json"), 0644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("SOURCES_CONFIG_PATH", tmpFile)

	sources := loadSources()
	greenhouse, lever := sources.Greenhouse, sources.Lever

	if len(greenhouse) != len(defaultGreenhouseSources) {
		t.Errorf("expected fallback greenhouse sources of length %d, got %d",
			len(defaultGreenhouseSources), len(greenhouse))
	}
	if len(lever) != len(defaultLeverSources) {
		t.Errorf("expected fallback lever sources of length %d, got %d",
			len(defaultLeverSources), len(lever))
	}
}
