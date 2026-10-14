package dev.jobdog.backend.jobreport;

import dev.jobdog.backend.job.JobEntity;
import dev.jobdog.backend.job.JobRepository;
import dev.jobdog.backend.job.JobStatus;
import dev.jobdog.backend.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Lets users tell us whether a listing's apply link actually works, and rewards them
 * for it with resume uploads.
 *
 * <p>The incentive is bounded on purpose. A confirmation can't be verified when it says
 * "works", so earning is capped per day — farming clicks buys a few extra uploads, not an
 * unlimited LLM bill. A report is one fixed verdict per user per listing; there is no
 * free text, so nothing a user types can end up as instructions to whoever reads these.
 */
@Service
public class JobReportService {

    /** Confirmations needed to earn one resume upload. */
    public static final int REPORTS_PER_CREDIT = 3;
    /** Ceiling on banked uploads. */
    static final int MAX_CREDITS = 25;
    /** New reports per UTC day that count toward credits (5 uploads a day at most). */
    static final int DAILY_COUNTED_REPORTS = 15;
    /** Distinct users reporting a listing dead before it is closed without anyone checking. */
    static final int CLOSE_AFTER_DEAD_REPORTS = 2;

    private final JobReportRepository reports;
    private final JobRepository jobs;
    private final UserRepository users;

    public JobReportService(JobReportRepository reports, JobRepository jobs, UserRepository users) {
        this.reports = reports;
        this.jobs = jobs;
        this.users = users;
    }

    @Transactional
    public Map<String, Object> report(UUID userId, UUID jobId, String rawVerdict) {
        String verdict = rawVerdict == null ? "" : rawVerdict.trim().toUpperCase(Locale.ROOT);
        if (!verdict.equals("WORKS") && !verdict.equals("DEAD")) {
            throw new IllegalArgumentException("verdict must be WORKS or DEAD");
        }

        JobEntity job = jobs.findById(jobId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Job not found"));

        Instant now = Instant.now();
        var existing = reports.findByJobIdAndUserId(jobId, userId);
        boolean firstReport = existing.isEmpty();

        // Reports on a listing that is already closed carry no information and earn nothing.
        boolean jobWasOpen = job.getStatus() == JobStatus.ACTIVE;
        boolean countsTowardCredit = firstReport && jobWasOpen
                && reports.countByUserIdAndCreatedAtAfter(userId, now.truncatedTo(ChronoUnit.DAYS)) < DAILY_COUNTED_REPORTS;

        JobReportEntity report = existing.orElseGet(JobReportEntity::new);
        report.setJobId(jobId);
        report.setUserId(userId);
        report.setVerdict(verdict);
        reports.save(report);

        boolean earnedCredit = false;
        if (countsTowardCredit) {
            users.bumpReportProgress(userId);
            earnedCredit = users.redeemReportProgress(userId, REPORTS_PER_CREDIT, MAX_CREDITS) > 0;
        }

        boolean closed = !jobWasOpen;
        if (jobWasOpen) {
            long dead = reports.countByJobIdAndVerdict(jobId, "DEAD");
            long works = reports.countByJobIdAndVerdict(jobId, "WORKS");
            if (dead >= CLOSE_AFTER_DEAD_REPORTS && dead > works) {
                job.setStatus(JobStatus.CLOSED);
                job.setDeadAt(now);
                jobs.save(job);
                closed = true;
            }
        }

        var credits = users.creditsOf(userId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("verdict", verdict);
        result.put("earnedCredit", earnedCredit);
        result.put("resumeCredits", credits.getResumeCredits());
        result.put("reportsToNextCredit", REPORTS_PER_CREDIT - credits.getReportCreditProgress());
        result.put("jobClosed", closed);
        return result;
    }

    /** jobId -> verdict for the user's most recent reports. */
    @Transactional(readOnly = true)
    public Map<String, String> verdictsFor(UUID userId) {
        Map<String, String> out = new LinkedHashMap<>();
        for (JobReportEntity r : reports.findRecentByUser(userId, PageRequest.of(0, 500))) {
            out.put(r.getJobId().toString(), r.getVerdict());
        }
        return out;
    }
}
