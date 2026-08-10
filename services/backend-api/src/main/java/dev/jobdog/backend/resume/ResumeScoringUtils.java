package dev.jobdog.backend.resume;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Deterministic (non-LLM) resume-to-requirement scoring helpers, shared by
 * application match scoring and resume grading so both use identical rules.
 */
public final class ResumeScoringUtils {

    private ResumeScoringUtils() {
    }

    public static double coverage(List<String> candidateSkills, List<String> jobSkills) {
        if (jobSkills == null || jobSkills.isEmpty()) {
            return 1.0;
        }
        Set<String> normalizedCandidateSkills = normalize(candidateSkills);
        Set<String> normalizedJobSkills = normalize(jobSkills);
        long matched = normalizedJobSkills.stream().filter(normalizedCandidateSkills::contains).count();
        return (double) matched / normalizedJobSkills.size();
    }

    public static double experienceAlignment(Integer candidateYears, Integer requiredYears) {
        if (requiredYears == null || requiredYears <= 0) {
            return 1.0;
        }
        if (candidateYears == null || candidateYears < 0) {
            return 0.0;
        }
        return Math.min(1.0, (double) candidateYears / requiredYears);
    }

    public static double educationAlignment(String candidateEducation, String requiredEducation) {
        if (requiredEducation == null || requiredEducation.isBlank()) {
            return 1.0;
        }
        if (candidateEducation == null || candidateEducation.isBlank()) {
            return 0.0;
        }
        return candidateEducation.trim().equalsIgnoreCase(requiredEducation.trim()) ? 1.0 : 0.5;
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
