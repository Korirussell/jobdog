package config

import (
	"os"
	"testing"
)

// TestLoadSourcesFromJSONMatchesEmbeddedDefaults is a regression guard
// ensuring that config/sources.json (the externalized company list) has not
// dropped any companies relative to the embedded hardcoded fallback lists.
func TestLoadSourcesFromJSONMatchesEmbeddedDefaults(t *testing.T) {
	t.Setenv("SOURCES_CONFIG_PATH", "sources.json")

	greenhouse, lever := loadSources()

	if len(greenhouse) != len(defaultGreenhouseSources) {
		t.Errorf("greenhouse source count mismatch: sources.json has %d, embedded defaults have %d",
			len(greenhouse), len(defaultGreenhouseSources))
	}

	if len(lever) != len(defaultLeverSources) {
		t.Errorf("lever source count mismatch: sources.json has %d, embedded defaults have %d",
			len(lever), len(defaultLeverSources))
	}
}

// TestLoadSourcesFallsBackWhenFileMissing ensures a missing/invalid sources
// config does not break the loader and falls back to the embedded defaults.
func TestLoadSourcesFallsBackWhenFileMissing(t *testing.T) {
	t.Setenv("SOURCES_CONFIG_PATH", "does-not-exist.json")

	greenhouse, lever := loadSources()

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

	greenhouse, lever := loadSources()

	if len(greenhouse) != len(defaultGreenhouseSources) {
		t.Errorf("expected fallback greenhouse sources of length %d, got %d",
			len(defaultGreenhouseSources), len(greenhouse))
	}
	if len(lever) != len(defaultLeverSources) {
		t.Errorf("expected fallback lever sources of length %d, got %d",
			len(defaultLeverSources), len(lever))
	}
}
