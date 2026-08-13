package dev.jobdog.backend.job;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface JobRepository extends JpaRepository<JobEntity, UUID> {

    @Query("SELECT j FROM JobEntity j WHERE j.status = :status ORDER BY COALESCE(j.postedAt, j.scrapedAt) DESC")
    Page<JobEntity> findByStatusOrderByEffectiveDateDesc(
            @Param("status") JobStatus status,
            Pageable pageable
    );

    Page<JobEntity> findByStatus(JobStatus status, Pageable pageable);

    // CAST(... AS string) on every nullable String parameter that is used inside a
    // function call (LOWER, CONCAT) is required, not decorative: PostgreSQL's JDBC
    // driver cannot infer a type for an untyped NULL parameter, defaults it to
    // bytea, and then "function lower(bytea) does not exist" fails the whole
    // query — even for filter combinations that never touch that specific
    // parameter, because Postgres type-checks a prepared statement before any
    // predicate runs. This affected :company and :search before this change too;
    // it was only ever masked by every prior filtered request also setting
    // :location, which happened to be the one parameter Hibernate could type
    // correctly on its own.
    @Query("SELECT j FROM JobEntity j WHERE j.status = :status " +
           "AND (:location IS NULL OR LOWER(j.location) LIKE LOWER(CONCAT('%', CAST(:location AS string), '%'))) " +
           "AND (:remote IS NULL OR :remote = false OR LOWER(j.location) LIKE '%remote%') " +
           "AND (:company IS NULL OR LOWER(j.company) LIKE LOWER(CONCAT('%', CAST(:company AS string), '%'))) " +
           "AND (:search IS NULL OR (LOWER(j.title) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')) " +
           "     OR LOWER(j.company) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))) " +
           "AND (:entryTypesActive = false OR j.entryType IN :entryTypes) " +
           // A job whose window doesn't include gradYear never matches — including
           // jobs with no window recorded at all (both bounds null), which is
           // correct: "graduating 2027" should not surface a posting with no known
           // eligibility window just because neither bound excludes it.
           "AND (:gradYear IS NULL OR (j.gradYearMin IS NOT NULL AND j.gradYearMax IS NOT NULL " +
           "     AND j.gradYearMin <= :gradYear AND j.gradYearMax >= :gradYear)) " +
           "AND (:companyTierActive = false OR LOWER(j.company) IN :companyTierCompanies) " +
           "AND (:hasSalary IS NULL OR :hasSalary = false OR j.salaryRaw IS NOT NULL) " +
           "ORDER BY COALESCE(j.postedAt, j.scrapedAt) DESC")
    Page<JobEntity> findByFilters(
            @Param("status") JobStatus status,
            @Param("location") String location,
            @Param("remote") Boolean remote,
            @Param("company") String company,
            @Param("search") String search,
            @Param("entryTypesActive") boolean entryTypesActive,
            @Param("entryTypes") Collection<String> entryTypes,
            @Param("gradYear") Integer gradYear,
            @Param("companyTierActive") boolean companyTierActive,
            @Param("companyTierCompanies") Collection<String> companyTierCompanies,
            @Param("hasSalary") Boolean hasSalary,
            Pageable pageable
    );

    Optional<JobEntity> findByIdAndStatus(UUID id, JobStatus status);

    Optional<JobEntity> findBySourceUrl(String sourceUrl);

    @Query("SELECT j FROM JobEntity j WHERE LOWER(j.company) = LOWER(:company)")
    List<JobEntity> findByCompanyIgnoreCase(@Param("company") String company);

    /**
     * Batched variant of {@link #findByCompanyIgnoreCase(String)} — fetches jobs for a set of
     * (already-lowercased) companies in one query, used by the batched Ghost Score lookup so a
     * page of job listings spanning many distinct companies doesn't trigger one query per company.
     */
    @Query("SELECT j FROM JobEntity j WHERE LOWER(j.company) IN :companies")
    List<JobEntity> findByCompanyIgnoreCaseIn(@Param("companies") Collection<String> companies);

    @Query("SELECT MAX(COALESCE(j.postedAt, j.scrapedAt)) FROM JobEntity j WHERE j.status = dev.jobdog.backend.job.JobStatus.ACTIVE")
    java.time.Instant findLatestEffectiveDateForActiveJobs();
}
