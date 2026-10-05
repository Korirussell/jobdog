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

		// Real titles from the live "SWE only" view that are not software —
		// Software has to say so; everything else is Other.
		{"Logistics Operations New College Grad- Bachelor's/Master's (Tracy, CA)", RoleCategoryOther},
		{"Asset Protection Representative", RoleCategoryOther},
		{"Manufacturing Engineer I, New College Grad- Bachelor's (Austin, TX)", RoleCategoryOther},
		{"Intern Engineer - Summer 2027", RoleCategoryOther},
		{"Analytics Intern", RoleCategoryOther},
		{"2026 Financial Analyst I, AD&S", RoleCategoryOther},
		{"Test Engineering Intern, MS - Summer 2027", RoleCategoryOther},
		{"Communications Intern - Summer 2027", RoleCategoryOther},
		{"New Grad 2027 - Advisor Licensing Program", RoleCategoryOther},

		// ...and the ones that are.
		{"Machine Learning Software Engineer 1", RoleCategorySoftware},
		{"Junior Software Engineer", RoleCategorySoftware},
		{"Research Scientist, ML Systems - PhD New College Grad 2026", RoleCategorySoftware},
		{"Software Engineering Intern, NCCL - 2026", RoleCategorySoftware},
		{"IT Intern Application Development", RoleCategorySoftware},
		{"Security Engineer, New Grad", RoleCategorySoftware},
		{"Data Engineer I", RoleCategorySoftware},
		{"Platform Engineer I", RoleCategorySoftware},
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
