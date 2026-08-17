package dev.jobdog.backend.resume;

import java.util.HashSet;
import java.util.List;
import java.util.OptionalDouble;
import java.util.Set;

/**
 * Deterministic (non-LLM) resume-to-requirement scoring helpers, shared by
 * application match scoring and resume grading so both use identical rules.
 *
 * Each method returns {@link OptionalDouble#empty()} — not a fake 1.0 — when
 * the job simply never stated that requirement. Most scraped postings never
 * get a minimum-years or education-level extracted, and many (especially
 * thin aggregator-only rows) have no skills extracted either, so treating
 * "nothing to compare against" as "perfect match" silently inflated every
 * match score toward 100 regardless of actual fit — the empty dimensions
 * dominated the weighted average instead of just staying out of it. Callers
 * must renormalize their weights over only the dimensions actually present.
 */
public final class ResumeScoringUtils {

    private ResumeScoringUtils() {
    }

    public static OptionalDouble coverage(List<String> candidateSkills, List<String> jobSkills) {
        if (jobSkills == null || jobSkills.isEmpty()) {
            return OptionalDouble.empty();
        }
        Set<String> normalizedCandidateSkills = normalize(candidateSkills);
        Set<String> normalizedJobSkills = normalize(jobSkills);
        long matched = normalizedJobSkills.stream().filter(normalizedCandidateSkills::contains).count();
        return OptionalDouble.of((double) matched / normalizedJobSkills.size());
    }

    public static OptionalDouble experienceAlignment(Integer candidateYears, Integer requiredYears) {
        if (requiredYears == null || requiredYears <= 0) {
            return OptionalDouble.empty();
        }
        if (candidateYears == null || candidateYears < 0) {
            return OptionalDouble.of(0.0);
        }
        return OptionalDouble.of(Math.min(1.0, (double) candidateYears / requiredYears));
    }

    public static OptionalDouble educationAlignment(String candidateEducation, String requiredEducation) {
        if (requiredEducation == null || requiredEducation.isBlank()) {
            return OptionalDouble.empty();
        }
        if (candidateEducation == null || candidateEducation.isBlank()) {
            return OptionalDouble.of(0.0);
        }
        return OptionalDouble.of(candidateEducation.trim().equalsIgnoreCase(requiredEducation.trim()) ? 1.0 : 0.5);
    }

    /** One scoring dimension: its value (absent if the job stated no such requirement) and its weight if present. */
    public record Weighted(OptionalDouble value, double weight) {
        public static Weighted of(OptionalDouble value, double weight) {
            return new Weighted(value, weight);
        }
    }

    /**
     * Weighted average over only the present dimensions, as a 0-100 int.
     * Renormalizes by the weight actually used rather than the nominal total,
     * so a job missing some requirements doesn't get diluted toward a fake
     * score — the weight simply isn't spent on a dimension with no signal.
     * Returns 0 (not a divide-by-zero) when nothing was measurable at all.
     */
    public static int weightedPercent(Weighted... dimensions) {
        double weightedSum = 0;
        double weightUsed = 0;
        for (Weighted d : dimensions) {
            if (d.value().isPresent()) {
                weightedSum += d.value().getAsDouble() * d.weight();
                weightUsed += d.weight();
            }
        }
        if (weightUsed == 0) {
            return 0;
        }
        return (int) Math.round((weightedSum / weightUsed) * 100);
    }

    private static Set<String> normalize(List<String> values) {
        Set<String> normalized = new HashSet<>();
        if (values == null) {
            return normalized;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                normalized.add(value.trim().toLowerCase());
            }
        }
        return normalized;
    }
}
