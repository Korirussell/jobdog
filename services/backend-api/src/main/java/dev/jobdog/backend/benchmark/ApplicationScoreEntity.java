package dev.jobdog.backend.benchmark;

import dev.jobdog.backend.application.ApplicationEntity;
import dev.jobdog.backend.common.persistence.BaseEntity;
import dev.jobdog.backend.common.persistence.JsonMapConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.ColumnTransformer;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "application_scores")
public class ApplicationScoreEntity extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false, unique = true)
    private ApplicationEntity application;

    @Column(nullable = false)
    private Integer matchScore;

    @Convert(converter = JsonMapConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private Map<String, Object> matchBreakdown;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private BenchmarkState benchmarkState;

    @Column
    private Integer percentile;

    @Column(nullable = false)
    private Integer applicantCount;

    @Column(nullable = false)
    private Instant scoredAt;

    public ApplicationEntity getApplication() {
        return application;
    }

    public void setApplication(ApplicationEntity application) {
        this.application = application;
    }

    public Integer getMatchScore() {
        return matchScore;
    }

    public void setMatchScore(Integer matchScore) {
        this.matchScore = matchScore;
    }

    public Map<String, Object> getMatchBreakdown() {
        return matchBreakdown;
    }

    public void setMatchBreakdown(Map<String, Object> matchBreakdown) {
        this.matchBreakdown = matchBreakdown;
    }

    public BenchmarkState getBenchmarkState() {
        return benchmarkState;
    }

    public void setBenchmarkState(BenchmarkState benchmarkState) {
        this.benchmarkState = benchmarkState;
    }

    public Integer getPercentile() {
        return percentile;
    }

    public void setPercentile(Integer percentile) {
        this.percentile = percentile;
    }

    public Integer getApplicantCount() {
        return applicantCount;
    }

    public void setApplicantCount(Integer applicantCount) {
        this.applicantCount = applicantCount;
    }

    public Instant getScoredAt() {
        return scoredAt;
    }

    public void setScoredAt(Instant scoredAt) {
        this.scoredAt = scoredAt;
    }
}
