package dev.jobdog.backend.job;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class JobService {

    private final JobRepository jobRepository;

    public JobService(JobRepository jobRepository) {
        this.jobRepository = jobRepository;
    }

    @Transactional(readOnly = true)
    public JobListResponse listActiveJobs() {
        List<JobSummaryResponse> items = jobRepository.findTop20ByStatusOrderByPostedAtDesc(JobStatus.ACTIVE)
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

        return new JobListResponse(items, 0, items.size(), items.size());
    }
}
