package dev.jobdog.backend.job;

public record JobFilterRequest(
        int page,
        int size,
        String location,
        Boolean remote,
        String company,
        String search,
        // "NEW_GRAD_COHORT" | "ENTRY_LEVEL_OPEN" | "INTERN" | "EXPERIENCED" — see
        // scraper.EntryType. Null means no cohort filter applied.
        String entryType,
        // Matches a job whose [gradYearMin, gradYearMax] window includes this year.
        // A job with no window recorded never matches a gradYear filter.
        Integer gradYear,
        // "FAANG" | "UNICORN" — see CompanyTier.
        String companyTier,
        // True restricts to postings with a published compensation string.
        Boolean hasSalary
) {
    public JobFilterRequest {
        if (page < 0) page = 0;
        if (size < 1 || size > 100) size = 20;
    }
}
