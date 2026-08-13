package dev.jobdog.backend.job;

import java.util.Set;

/**
 * Curated company-tier lookup for job card tagging. Deliberately a small hardcoded
 * list (mirrors the pattern already used for BenchmarkService's seed data) rather
 * than a database table — the tier a company belongs to is an editorial judgment
 * call, not scraped data, and doesn't need migration/admin tooling at this scale.
 */
public final class CompanyTier {

    private static final Set<String> FAANG = Set.of(
            "google", "meta", "facebook", "amazon", "apple", "netflix", "microsoft"
    );

    private static final Set<String> UNICORN = Set.of(
            "stripe", "databricks", "cloudflare", "openai", "anthropic", "airbnb",
            "doordash", "instacart", "figma", "notion", "canva", "discord",
            "coinbase", "robinhood", "plaid", "brex", "ramp", "scale ai"
    );

    private CompanyTier() {
    }

    /**
     * Returns the (lowercased) company names belonging to a tier, for use in a
     * {@code company IN (...)} filter. Unknown or null tiers return an empty set
     * rather than throwing, since a filter with no matches is a valid outcome and
     * simpler for the caller than a checked exception.
     */
    public static Set<String> companiesForTier(String tier) {
        if (tier == null) {
            return Set.of();
        }
        return switch (tier.trim().toUpperCase()) {
            case "FAANG" -> FAANG;
            case "UNICORN" -> UNICORN;
            default -> Set.of();
        };
    }

    public static String lookup(String company) {
        if (company == null || company.isBlank()) {
            return null;
        }
        String normalized = company.trim().toLowerCase();
        if (FAANG.contains(normalized)) {
            return "FAANG";
        }
        if (UNICORN.contains(normalized)) {
            return "UNICORN";
        }
        return null;
    }
}
