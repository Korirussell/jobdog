package dev.jobdog.backend.job;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class CompanyTierTest {

    @Test
    void lookup_matchesKnownFaangCompaniesCaseInsensitively() {
        assertEquals("FAANG", CompanyTier.lookup("Google"));
        assertEquals("FAANG", CompanyTier.lookup("meta"));
        assertEquals("FAANG", CompanyTier.lookup("AMAZON"));
    }

    @Test
    void lookup_matchesKnownUnicorns() {
        assertEquals("UNICORN", CompanyTier.lookup("Stripe"));
        assertEquals("UNICORN", CompanyTier.lookup("Databricks"));
    }

    @Test
    void lookup_returnsNullForUnknownCompany() {
        assertNull(CompanyTier.lookup("Some Random Startup LLC"));
    }
}
