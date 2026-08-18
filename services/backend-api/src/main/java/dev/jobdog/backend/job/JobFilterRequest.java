package dev.jobdog.backend.job;

import java.util.List;

public record JobFilterRequest(
        int page,
        int size,
        String location,
        Boolean remote,
        String company,
        String search,
        // Each value is "NEW_GRAD_COHORT" | "ENTRY_LEVEL_OPEN" | "INTERN" |
        // "EXPERIENCED" — see scraper.EntryType. A job matches if its entryType is
        // any of these; null/empty means no cohort filter applied. Plural because
        // the frontend's "New Grad" tab means "cohort-gated OR open entry-level",
        // not one single type.
        List<String> entryTypes,
        // Matches a job whose [gradYearMin, gradYearMax] window includes this year.
        // A job with no window recorded never matches a gradYear filter.
        Integer gradYear,
        // "FAANG" | "UNICORN" — see CompanyTier.
        String companyTier,
        // True restricts to postings with a published compensation string.
        Boolean hasSalary,
        // True restricts to role_category = 'SOFTWARE' and location_scope =
        // 'US_OR_REMOTE' — see scraper.RoleCategory / scraper.LocationScope. This is
        // the board's default view; the frontend sends false explicitly for its
        // "show all roles" toggle.
        Boolean sweOnly
) {
    public JobFilterRequest {
        if (page < 0) page = 0;
        if (size < 1 || size > 100) size = 20;
    }
}
