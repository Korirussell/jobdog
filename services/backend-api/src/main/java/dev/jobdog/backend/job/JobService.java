package dev.jobdog.backend.job;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class JobService {

    private final JobRepository jobRepository;

    public JobService(JobRepository jobRepository) {
        this.jobRepository = jobRepository;
    }

    @Transactional(readOnly = true)
    public JobListResponse listActiveJobs(JobFilterRequest filter) {
        // Pageable without sort — ordering is handled by COALESCE in the JPQL queries
        Pageable pageable = PageRequest.of(filter.page(), filter.size());

        Page<JobEntity> jobPage;

        if (hasFilters(filter)) {
            jobPage = jobRepository.findByFilters(
                    JobStatus.ACTIVE,
                    filter.location(),
                    filter.remote(),
                    filter.company(),
                    filter.search(),
                    pageable
            );
        } else {
            jobPage = jobRepository.findByStatusOrderByEffectiveDateDesc(JobStatus.ACTIVE, pageable);
        }

        List<JobSummaryResponse> items = jobPage.getContent()
                .stream()
                .map(job -> new JobSummaryResponse(
                        job.getId(),
                        job.getTitle(),
                        job.getCompany(),
                        job.getLocation(),
                        job.getEmploymentType(),
                        job.getPostedAt(),
                        job.getScrapedAt(),
                        job.getStatus().name(),
                        job.getSourceUrl()
                ))
                .toList();

        Instant lastSync = jobRepository.findLatestEffectiveDateForActiveJobs();

        return new JobListResponse(items, filter.page(), filter.size(), jobPage.getTotalElements(), lastSync);
    }

    private boolean hasFilters(JobFilterRequest filter) {
        return filter.location() != null ||
               filter.remote() != null ||
               filter.company() != null ||
               filter.search() != null;
    }
}
