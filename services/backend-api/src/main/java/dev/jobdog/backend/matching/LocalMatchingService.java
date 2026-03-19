package dev.jobdog.backend.matching;

import dev.jobdog.backend.resume.ResumeProfileEntity;
import dev.jobdog.backend.resume.ResumeProfileRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class LocalMatchingService {

    private final ResumeProfileRepository resumeProfileRepository;

    public LocalMatchingService(ResumeProfileRepository resumeProfileRepository) {
        this.resumeProfileRepository = resumeProfileRepository;
    }

    /**
     * Extract flattened technical skills from a user's parsed resume.
     * Returns normalized lowercase skills for matching.
     */
    public List<String> extractUserSkills(UUID userId) {
        // Get the most recent resume profile for this user
        Optional<ResumeProfileEntity> profileOpt = resumeProfileRepository
                .findTopByResume_User_IdOrderByResume_UploadedAtDesc(userId);
        
        if (profileOpt.isEmpty()) {
            return Collections.emptyList();
        }

        ResumeProfileEntity profile = profileOpt.get();
        List<String> skills = profile.getSkills();
        
        if (skills == null || skills.isEmpty()) {
            return Collections.emptyList();
        }

        // Normalize: lowercase, trim, deduplicate
        return skills.stream()
                .filter(Objects::nonNull)
                .map(String::toLowerCase)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .collect(Collectors.toList());
    }

    /**
     * Calculate a basic keyword overlap match percentage (0-100) between user skills
     * and a job description using simple TF-IDF-like scoring.
     */
    public int calculateMatchPercentage(List<String> userSkills, String jobDescriptionPlain) {
        if (userSkills == null || userSkills.isEmpty()) {
            return 0;
        }
        if (jobDescriptionPlain == null || jobDescriptionPlain.isBlank()) {
            return 0;
        }

        String normalizedJobDesc = jobDescriptionPlain.toLowerCase();
        
        // Count how many user skills appear in the job description
        int matchedSkills = 0;
        int totalSkills = userSkills.size();
        
        for (String skill : userSkills) {
            if (containsSkill(normalizedJobDesc, skill)) {
                matchedSkills++;
            }
        }

        if (totalSkills == 0) {
            return 0;
        }

        // Simple percentage: (matched / total) * 100
        // We can add weighting later (e.g., boost for exact multi-word matches)
        double rawPercentage = (double) matchedSkills / totalSkills * 100.0;
        
        // Cap at 100 and floor at 0
        return Math.max(0, Math.min(100, (int) Math.round(rawPercentage)));
    }

    /**
     * Check if a skill appears in the job description.
     * Handles multi-word skills and common variations.
     */
    private boolean containsSkill(String jobDesc, String skill) {
        // Direct substring match
        if (jobDesc.contains(skill)) {
            return true;
        }

        // Handle common variations (e.g., "react" matches "react.js" or "reactjs")
        if (skill.equals("react") && (jobDesc.contains("react.js") || jobDesc.contains("reactjs"))) {
            return true;
        }
        if (skill.equals("node") && (jobDesc.contains("node.js") || jobDesc.contains("nodejs"))) {
            return true;
        }
        if (skill.equals("vue") && (jobDesc.contains("vue.js") || jobDesc.contains("vuejs"))) {
            return true;
        }
        if (skill.equals("next") && (jobDesc.contains("next.js") || jobDesc.contains("nextjs"))) {
            return true;
        }

        // Handle plurals and common suffixes
        if (jobDesc.contains(skill + "s") || jobDesc.contains(skill + "js")) {
            return true;
        }

        return false;
    }

    /**
     * Calculate match percentage for a specific user and job description.
     * Convenience method that combines extraction and matching.
     */
    public int calculateUserJobMatch(UUID userId, String jobDescriptionPlain) {
        List<String> userSkills = extractUserSkills(userId);
        return calculateMatchPercentage(userSkills, jobDescriptionPlain);
    }
}
