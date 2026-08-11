package dev.jobdog.backend.ghost;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface GhostReportRepository extends JpaRepository<GhostReportEntity, UUID> {

    @Query(value = "SELECT COUNT(*) FROM ghost_reports WHERE LOWER(company) = LOWER(:company)", nativeQuery = true)
    long countByCompanyIgnoreCase(@Param("company") String company);

    /**
     * Batched variant of {@link #countByCompanyIgnoreCase(String)} — counts ghost reports for a
     * set of companies grouped by (lowercased) company name in a single query, so callers with a
     * page of jobs spanning many distinct companies don't issue one query per company.
     */
    @Query(value = "SELECT LOWER(company) AS company, COUNT(*) AS cnt FROM ghost_reports "
            + "WHERE LOWER(company) IN (:companies) GROUP BY LOWER(company)", nativeQuery = true)
    List<CompanyReportCount> countByCompaniesIgnoreCase(@Param("companies") Collection<String> companies);

    interface CompanyReportCount {
        String getCompany();
        Long getCnt();
    }
}
