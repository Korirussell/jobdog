package dev.jobdog.backend.resume;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ResumeScoringUtilsTest {

    @Test
    void coverage_returnsFullScoreWhenNoJobSkillsRequired() {
        assertEquals(1.0, ResumeScoringUtils.coverage(List.of("Java"), List.of()));
        assertEquals(1.0, ResumeScoringUtils.coverage(List.of("Java"), null));
    }

    @Test
    void coverage_matchesCaseInsensitively() {
        assertEquals(1.0, ResumeScoringUtils.coverage(List.of("java", "Python"), List.of("Java")));
    }

    @Test
    void coverage_returnsPartialScoreForPartialOverlap() {
        assertEquals(0.5, ResumeScoringUtils.coverage(List.of("Java"), List.of("Java", "Go")));
    }

    @Test
    void experienceAlignment_returnsFullScoreWhenNoRequirement() {
        assertEquals(1.0, ResumeScoringUtils.experienceAlignment(0, 0));
        assertEquals(1.0, ResumeScoringUtils.experienceAlignment(null, null));
    }

    @Test
    void experienceAlignment_returnsZeroWhenCandidateMissingButRequired() {
        assertEquals(0.0, ResumeScoringUtils.experienceAlignment(null, 2));
    }

    @Test
    void experienceAlignment_capsAtOneWhenCandidateExceedsRequirement() {
        assertEquals(1.0, ResumeScoringUtils.experienceAlignment(5, 2));
    }

    @Test
    void educationAlignment_returnsHalfScoreForMismatch() {
        assertEquals(0.5, ResumeScoringUtils.educationAlignment("Associate", "Bachelor"));
    }

    @Test
    void educationAlignment_returnsFullScoreForExactMatchIgnoringCase() {
        assertEquals(1.0, ResumeScoringUtils.educationAlignment("bachelor", "Bachelor"));
    }
}
