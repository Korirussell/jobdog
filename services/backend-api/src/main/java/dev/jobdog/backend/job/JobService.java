package dev.jobdog.backend.job;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class JobService {

    private final JobRepository jobRepository;

    public JobService(JobRepository jobRepository) {
        this.jobRepository = jobRepository;
    }

    @Cacheable(value = "jobs", key = "#filter.hashCode()")
    @Transactional(readOnly = true)
    public JobListResponse listActiveJobs(JobFilterRequest filter) {
        Pageable pageable = PageRequest.of(
                filter.page(),
                filter.size(),
                Sort.by(Sort.Direction.DESC, "postedAt")
        );

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
            jobPage = jobRepository.findByStatus(JobStatus.ACTIVE, pageable);
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
                        job.getSourceUrl()
                ))
                .toList();

        return new JobListResponse(items, filter.page(), filter.size(), jobPage.getTotalElements());
    }

    private boolean hasFilters(JobFilterRequest filter) {
        return filter.location() != null ||
               filter.remote() != null ||
               filter.company() != null ||
               filter.search() != null;
    }
}
