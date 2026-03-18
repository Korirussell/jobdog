package dev.jobdog.backend.ghost;

import dev.jobdog.backend.common.persistence.BaseEntity;
import dev.jobdog.backend.job.JobEntity;
import dev.jobdog.backend.user.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "ghost_reports")
public class GhostReportEntity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 255)
    private String company;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id")
    private JobEntity job;

    @Column(nullable = false)
    private Instant reportedAt;

    public UserEntity getUser() { return user; }
    public void setUser(UserEntity user) { this.user = user; }
    public String getCompany() { return company; }
    public void setCompany(String company) { this.company = company; }
    public JobEntity getJob() { return job; }
    public void setJob(JobEntity job) { this.job = job; }
    public Instant getReportedAt() { return reportedAt; }
    public void setReportedAt(Instant reportedAt) { this.reportedAt = reportedAt; }
}
