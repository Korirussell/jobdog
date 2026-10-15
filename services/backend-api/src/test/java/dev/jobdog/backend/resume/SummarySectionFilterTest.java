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

    @Test
    void stripsOnlyTheSentenceThatPushesASummary() {
        String verdict = "Strong resume. Adding a summary statement would also improve the presentation. Quantify the impact.";
        org.junit.jupiter.api.Assertions.assertEquals("Strong resume. Quantify the impact.", ResumeAnalysisService.withoutSummaryAdvice(verdict));
        org.junit.jupiter.api.Assertions.assertEquals("Fine as is.", ResumeAnalysisService.withoutSummaryAdvice("Fine as is."));
    }
}
