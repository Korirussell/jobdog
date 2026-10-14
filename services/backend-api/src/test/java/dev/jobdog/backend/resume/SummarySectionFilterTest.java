package dev.jobdog.backend.resume;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SummarySectionFilterTest {

    @Test
    void flagsAdvicePushingASummarySection() {
        assertTrue(ResumeAnalysisService.recommendsSummarySection("Add a professional summary at the top"));
        assertTrue(ResumeAnalysisService.recommendsSummarySection("No objective statement"));
        assertTrue(ResumeAnalysisService.recommendsSummarySection("Missing Summary Section"));
        assertTrue(ResumeAnalysisService.recommendsSummarySection("Add a brief summary"));
    }

    @Test
    void leavesRealAdviceAlone() {
        assertFalse(ResumeAnalysisService.recommendsSummarySection("Quantify the impact of the Kafka pipeline"));
        assertFalse(ResumeAnalysisService.recommendsSummarySection("Skills"));
        assertFalse(ResumeAnalysisService.recommendsSummarySection("Your goal of reaching SWE roles is clear"));
        assertFalse(ResumeAnalysisService.recommendsSummarySection(null));
    }
}
