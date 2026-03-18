package dev.jobdog.backend.savedjob;

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
@Table(name = "saved_jobs")
public class SavedJobEntity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_id", nullable = false)
    private JobEntity job;

    @Column(nullable = false)
    private Instant savedAt;

    public UserEntity getUser() { return user; }
    public void setUser(UserEntity user) { this.user = user; }
    public JobEntity getJob() { return job; }
    public void setJob(JobEntity job) { this.job = job; }
    public Instant getSavedAt() { return savedAt; }
    public void setSavedAt(Instant savedAt) { this.savedAt = savedAt; }
}
