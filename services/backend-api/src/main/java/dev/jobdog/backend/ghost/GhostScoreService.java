package dev.jobdog.backend.ghost;

import dev.jobdog.backend.job.JobEntity;
import dev.jobdog.backend.job.JobRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Computes Ghost Score (0-100): a weighted signal of how likely a company's job postings
 * are stale/"ghost" listings, based on average days a posting stays open and the ratio of
 * user-submitted ghost reports to total jobs posted.
 * <p>
 * Shared by {@link GhostScoreController}'s single-company endpoint and the batched lookup
 * used by job listing responses, so the scoring formula lives in exactly one place.
 */
@Service
public class GhostScoreService {

    private final GhostReportRepository ghostReportRepository;
    private final JobRepository jobRepository;

    public GhostScoreService(GhostReportRepository ghostReportRepository, JobRepository jobRepository) {
        this.ghostReportRepository = ghostReportRepository;
        this.jobRepository = jobRepository;
    }

    /**
     * Computes Ghost Scores for a set of companies in two queries total (not one per company),
     * so a page of job listings spanning many distinct companies doesn't cause an N+1 lookup.
     *
     * @param companies distinct company names (any casing) to score
     * @return map of lowercased company name to Ghost Score; companies with no jobs on record
     *         score 0.0, matching the single-company endpoint's behavior for unknown companies
     */
    public Map<String, Double> computeGhostScores(Set<String> companies) {
        Set<String> normalized = normalize(companies);
        if (normalized.isEmpty()) {
            return Map.of();
        }

        Map<String, Long> ghostReportCounts = ghostReportRepository.countByCompaniesIgnoreCase(normalized)
                .stream()
                .collect(Collectors.toMap(GhostReportRepository.CompanyReportCount::getCompany,
                        GhostReportRepository.CompanyReportCount::getCnt));

        Map<String, List<JobEntity>> jobsByCompany = jobRepository.findByCompanyIgnoreCaseIn(normalized)
                .stream()
                .collect(Collectors.groupingBy(j -> j.getCompany().trim().toLowerCase()));

        Map<String, Double> result = new HashMap<>();
        for (String company : normalized) {
            List<JobEntity> jobs = jobsByCompany.getOrDefault(company, List.of());
            long ghostReports = ghostReportCounts.getOrDefault(company, 0L);
            result.put(company, (double) computeGhostScore(averageDaysOpen(jobs), ghostReports, jobs.size()));
        }
        return result;
    }

    /**
     * Computes the Ghost Score formula shared by the single-company and batched lookups.
     */
    int computeGhostScore(double avgDaysOpen, long ghostReports, long totalJobs) {
        if (totalJobs == 0) {
            return 0;
        }

        // Days component: jobs open > 60 days are suspicious, > 120 days very suspicious
        double daysComponent = Math.min(1.0, avgDaysOpen / 120.0) * 50;

        // Ghost report ratio component
        double reportRatio = (double) ghostReports / Math.max(1, totalJobs);
        double reportComponent = Math.min(1.0, reportRatio) * 50;

        return (int) Math.round(Math.min(100, daysComponent + reportComponent));
    }

    double averageDaysOpen(List<JobEntity> jobs) {
        return jobs.stream()
                .filter(j -> j.getPostedAt() != null)
                .mapToLong(j -> Duration.between(j.getPostedAt(), Instant.now()).toDays())
                .average()
                .orElse(0.0);
    }

    private Set<String> normalize(Set<String> companies) {
        if (companies == null || companies.isEmpty()) {
            return Set.of();
        }
        return companies.stream()
                .filter(c -> c != null && !c.isBlank())
                .map(c -> c.trim().toLowerCase())
                .collect(Collectors.toSet());
    }
}
