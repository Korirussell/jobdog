package scraper

import (
	"strings"
	"testing"
)

func TestStripHTML_PlainTags(t *testing.T) {
	got := stripHTML("<p>Hello <strong>world</strong></p>")
	if got != "Hello world" {
		t.Errorf("stripHTML() = %q, want %q", got, "Hello world")
	}
}

// TestStripHTML_DoublyEscapedContent guards against a real bug found on
// production: SpaceX's Greenhouse content field is doubly-escaped — the
// whole field is a literal "&lt;div&gt;...&lt;/div&gt;" string, not real
// tags. Before decoding entities first, the tag-stripping regex found
// nothing to strip (no literal '<'), so the escaped markup leaked straight
// through to the stored description and rendered as visible garbage on the
// job detail page.
func TestStripHTML_DoublyEscapedContent(t *testing.T) {
	input := `&lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;SpaceX was founded under the belief that a future where humanity is out exploring the stars is fundamentally more exciting than one where we are not. Today SpaceX is actively developing the technologies to make this possible, with the ultimate goal of&amp;nbsp;enabling human life on Mars.&lt;/p&gt;&lt;/div&gt;`

	got := stripHTML(input)

	if got == input {
		t.Fatal("stripHTML() left doubly-escaped content completely unchanged")
	}
	for _, forbidden := range []string{"&lt;", "&gt;", "&quot;", "&amp;", "<div", "<p>", "</p>", "</div>"} {
		if strings.Contains(got, forbidden) {
			t.Errorf("stripHTML() result still contains %q: %q", forbidden, got)
		}
	}
	if !strings.Contains(got, "SpaceX was founded") {
		t.Errorf("stripHTML() lost the actual text content: %q", got)
	}
}
