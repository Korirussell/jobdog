package dev.jobdog.backend.job;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

    @Test
    void lookup_matchesNotableEmployers() {
        assertEquals("NOTABLE", CompanyTier.lookup("Northrop Grumman"));
        assertEquals("NOTABLE", CompanyTier.lookup("Capital One"));
        assertEquals("UNICORN", CompanyTier.lookup("Tesla"));
        assertEquals("FAANG", CompanyTier.lookup("Google"));
    }

    @Test
    void anyTier_isTheUnionOfAllTiers() {
        var any = CompanyTier.companiesForTier("ANY");
        assertTrue(any.containsAll(CompanyTier.companiesForTier("FAANG")));
        assertTrue(any.containsAll(CompanyTier.companiesForTier("UNICORN")));
        assertTrue(any.containsAll(CompanyTier.companiesForTier("NOTABLE")));
        assertTrue(CompanyTier.companiesForTier("bogus").isEmpty());
    }
}
