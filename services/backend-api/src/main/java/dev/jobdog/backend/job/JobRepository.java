package dev.jobdog.backend.job;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface JobRepository extends JpaRepository<JobEntity, UUID> {

    Page<JobEntity> findByStatus(JobStatus status, Pageable pageable);

    @Query("SELECT j FROM JobEntity j WHERE j.status = :status " +
           "AND (:location IS NULL OR LOWER(j.location) LIKE LOWER(CONCAT('%', :location, '%'))) " +
           "AND (:remote IS NULL OR :remote = false OR LOWER(j.location) LIKE '%remote%') " +
           "AND (:company IS NULL OR LOWER(j.company) LIKE LOWER(CONCAT('%', :company, '%'))) " +
           "AND (:search IS NULL OR LOWER(j.title) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "     OR LOWER(j.descriptionText) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<JobEntity> findByFilters(
            @Param("status") JobStatus status,
            @Param("location") String location,
            @Param("remote") Boolean remote,
            @Param("company") String company,
            @Param("search") String search,
            Pageable pageable
    );

    Optional<JobEntity> findBySourceUrl(String sourceUrl);
}
