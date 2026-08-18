package scraper

import "testing"

func TestClassifyRoleCategory(t *testing.T) {
	cases := []struct {
		title string
		want  RoleCategory
	}{
		{"Software Engineer, New Grad", RoleCategorySoftware},
		{"Backend Engineer I", RoleCategorySoftware},
		{"Quantitative Trader", RoleCategoryQuant},
		{"Quantitative Developer", RoleCategoryQuant},
		{"Algorithmic Trading Analyst", RoleCategoryQuant},
		{"Hardware Engineer", RoleCategoryHardware},
		{"FPGA Engineer", RoleCategoryHardware},
		{"Software Engineer, Embedded", RoleCategorySoftware},
		{"Product Manager", RoleCategoryProduct},
		{"Technical Program Manager", RoleCategoryProduct},
		{"Account Executive", RoleCategorySales},
		{"Sales Development Representative", RoleCategorySales},
	}

	for _, tc := range cases {
		t.Run(tc.title, func(t *testing.T) {
			if got := ClassifyRoleCategory(tc.title); got != tc.want {
				t.Errorf("ClassifyRoleCategory(%q) = %q, want %q", tc.title, got, tc.want)
			}
		})
	}
}

func TestClassifyLocationScope(t *testing.T) {
	cases := []struct {
		location string
		want     LocationScope
	}{
		{"", LocationScopeUSOrRemote},
		{"San Francisco, CA", LocationScopeUSOrRemote},
		{"Remote", LocationScopeUSOrRemote},
		{"Remote - US", LocationScopeUSOrRemote},
		{"Remote (UK)", LocationScopeUSOrRemote}, // remote wins outright, see rationale in ClassifyLocationScope
		{"London, UK", LocationScopeNonUS},
		{"Bangalore, India", LocationScopeNonUS},
		{"Toronto, Canada", LocationScopeNonUS},
		{"Multiple Locations", LocationScopeUSOrRemote},
	}

	for _, tc := range cases {
		t.Run(tc.location, func(t *testing.T) {
			if got := ClassifyLocationScope(tc.location); got != tc.want {
				t.Errorf("ClassifyLocationScope(%q) = %q, want %q", tc.location, got, tc.want)
			}
		})
	}
}
