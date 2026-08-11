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
