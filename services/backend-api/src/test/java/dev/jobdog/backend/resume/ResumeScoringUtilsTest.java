package dev.jobdog.backend.resume;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ResumeScoringUtilsTest {

    @Test
    void coverage_isAbsentWhenNoJobSkillsRequired() {
        assertTrue(ResumeScoringUtils.coverage(List.of("Java"), List.of()).isEmpty());
        assertTrue(ResumeScoringUtils.coverage(List.of("Java"), null).isEmpty());
    }

    @Test
    void coverage_matchesCaseInsensitively() {
        assertEquals(1.0, ResumeScoringUtils.coverage(List.of("java", "Python"), List.of("Java")).getAsDouble());
    }

    @Test
    void coverage_returnsPartialScoreForPartialOverlap() {
        assertEquals(0.5, ResumeScoringUtils.coverage(List.of("Java"), List.of("Java", "Go")).getAsDouble());
    }

    @Test
    void experienceAlignment_isAbsentWhenNoRequirement() {
        assertTrue(ResumeScoringUtils.experienceAlignment(0, 0).isEmpty());
        assertTrue(ResumeScoringUtils.experienceAlignment(null, null).isEmpty());
    }

    @Test
    void experienceAlignment_returnsZeroWhenCandidateMissingButRequired() {
        assertEquals(0.0, ResumeScoringUtils.experienceAlignment(null, 2).getAsDouble());
    }

    @Test
    void experienceAlignment_capsAtOneWhenCandidateExceedsRequirement() {
        assertEquals(1.0, ResumeScoringUtils.experienceAlignment(5, 2).getAsDouble());
    }

    @Test
    void educationAlignment_isAbsentWhenNoRequirement() {
        assertFalse(ResumeScoringUtils.educationAlignment("Bachelor", "").isPresent());
    }

    @Test
    void educationAlignment_returnsHalfScoreForMismatch() {
        assertEquals(0.5, ResumeScoringUtils.educationAlignment("Associate", "Bachelor").getAsDouble());
    }

    @Test
    void educationAlignment_returnsFullScoreForExactMatchIgnoringCase() {
        assertEquals(1.0, ResumeScoringUtils.educationAlignment("bachelor", "Bachelor").getAsDouble());
    }
}
