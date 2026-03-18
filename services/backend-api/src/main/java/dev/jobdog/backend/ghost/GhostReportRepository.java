package dev.jobdog.backend.ghost;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface GhostReportRepository extends JpaRepository<GhostReportEntity, UUID> {

    @Query(value = "SELECT COUNT(*) FROM ghost_reports WHERE LOWER(company) = LOWER(:company)", nativeQuery = true)
    long countByCompanyIgnoreCase(@Param("company") String company);
}
