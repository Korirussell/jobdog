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

    // Broadened from the original 18-company seed list — it was missing enough
    // recognizable names (Nvidia, Uber, Palantir, Salesforce...) that most job
    // cards showed no tier flag at all, which read as the feature being broken
    // rather than the company genuinely being untiered.
    private static final Set<String> UNICORN = Set.of(
            "stripe", "databricks", "cloudflare", "openai", "anthropic", "airbnb",
            "doordash", "instacart", "figma", "notion", "canva", "discord",
            "coinbase", "robinhood", "plaid", "brex", "ramp", "scale ai",
            "nvidia", "uber", "lyft", "palantir", "snowflake", "salesforce",
            "adobe", "oracle", "servicenow", "workday", "intuit", "atlassian",
            "twilio", "block", "square", "mongodb", "elastic", "hashicorp",
            "gitlab", "github", "reddit", "pinterest", "snap", "spotify",
            "roblox", "epic games", "unity", "bloomberg", "two sigma",
            "tesla", "spacex", "anduril", "intel", "amd", "qualcomm", "broadcom", "cisco", "ibm",
            "tiktok", "bytedance", "twitch", "autodesk", "electronic arts", "expedia group",
            "shopify", "duolingo", "applied intuition", "cerebras", "shield ai", "verkada",
            "klaviyo", "affirm", "astera labs", "cadence", "cadence design systems",
            "jane street", "citadel", "hudson river trading", "jump trading",
            "d.e. shaw", "sig", "susquehanna international group"
    );

    // Recognisable employers that aren't tech-first: chips, defense and aerospace, finance,
    // industrial. Lowercased exact company names as scraped.
    private static final Set<String> NOTABLE = Set.of(
            "micron", "marvell", "applied materials", "kla", "globalfoundries", "garmin",
            "hewlett packard enterprise", "hpe", "hp", "motorola", "honeywell", "rockwell automation",
            "ge aerospace", "ge vernova", "general motors", "lockheed martin", "northrop grumman", "rtx",
            "raytheon", "the boeing company", "boeing", "general dynamics",
            "general dynamics information technology", "general dynamics mission systems", "leidos",
            "l3harris technologies", "bae systems", "booz allen", "blue origin",
            "johns hopkins applied physics laboratory", "the aerospace corporation",
            "visa", "mastercard", "american express", "capital one", "jpmorgan chase", "jpmorgan chase & co.",
            "goldman sachs", "morgan stanley", "citi", "citigroup", "fidelity investments", "vanguard",
            "state street", "bny", "barclays", "td bank", "royal bank of canada", "wells fargo",
            "bank of america", "paypal"
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
            case "NOTABLE" -> NOTABLE;
            case "ANY" -> ANY;
            default -> Set.of();
        };
    }

    // Every named company, any tier: the "well-known" filter.
    private static final Set<String> ANY = unionOf(FAANG, UNICORN, NOTABLE);

    @SafeVarargs
    private static Set<String> unionOf(Set<String>... sets) {
        java.util.HashSet<String> all = new java.util.HashSet<>();
        for (Set<String> set : sets) {
            all.addAll(set);
        }
        return Set.copyOf(all);
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
        if (NOTABLE.contains(normalized)) {
            return "NOTABLE";
        }
        return null;
    }
}
