package dev.jobdog.backend.resume;

import dev.jobdog.backend.common.persistence.BaseEntity;
import dev.jobdog.backend.common.persistence.StringListConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "resume_analyses")
public class ResumeAnalysisEntity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "resume_id", nullable = false)
    private ResumeEntity resume;

    @Column(nullable = false, length = 16)
    private String userLevel;

    @Column(length = 120)
    private String targetRole;

    @Column(nullable = false)
    private Integer overallScore;

    @Column(nullable = false)
    private Integer atsScore;

    @Convert(converter = StringListConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private List<String> atsIssues;

    // section_scores: { "experience": 72, "skills": 88, ... }
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Integer> sectionScores;

    // bullet_feedback: [{ "original": "...", "score": 80, "issue": "...", "improved": "..." }]
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> bulletFeedback;

    @Convert(converter = StringListConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private List<String> strengths;

    @Convert(converter = StringListConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private List<String> improvements;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String summaryVerdict;

    // Full structured parse of the resume as ATS would see it
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> atsParsedSections;

    // Recruiter's honest take on each section
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Map<String, Object>> recruiterTake;

    @Column(nullable = false)
    private Instant analyzedAt;

    public ResumeEntity getResume() { return resume; }
    public void setResume(ResumeEntity resume) { this.resume = resume; }
    public String getUserLevel() { return userLevel; }
    public void setUserLevel(String userLevel) { this.userLevel = userLevel; }
    public String getTargetRole() { return targetRole; }
    public void setTargetRole(String targetRole) { this.targetRole = targetRole; }
    public Integer getOverallScore() { return overallScore; }
    public void setOverallScore(Integer overallScore) { this.overallScore = overallScore; }
    public Integer getAtsScore() { return atsScore; }
    public void setAtsScore(Integer atsScore) { this.atsScore = atsScore; }
    public List<String> getAtsIssues() { return atsIssues; }
    public void setAtsIssues(List<String> atsIssues) { this.atsIssues = atsIssues; }
    public Map<String, Integer> getSectionScores() { return sectionScores; }
    public void setSectionScores(Map<String, Integer> sectionScores) { this.sectionScores = sectionScores; }
    public List<Map<String, Object>> getBulletFeedback() { return bulletFeedback; }
    public void setBulletFeedback(List<Map<String, Object>> bulletFeedback) { this.bulletFeedback = bulletFeedback; }
    public List<String> getStrengths() { return strengths; }
    public void setStrengths(List<String> strengths) { this.strengths = strengths; }
    public List<String> getImprovements() { return improvements; }
    public void setImprovements(List<String> improvements) { this.improvements = improvements; }
    public String getSummaryVerdict() { return summaryVerdict; }
    public void setSummaryVerdict(String summaryVerdict) { this.summaryVerdict = summaryVerdict; }
    public Map<String, Object> getAtsParsedSections() { return atsParsedSections; }
    public void setAtsParsedSections(Map<String, Object> atsParsedSections) { this.atsParsedSections = atsParsedSections; }
    public List<Map<String, Object>> getRecruiterTake() { return recruiterTake; }
    public void setRecruiterTake(List<Map<String, Object>> recruiterTake) { this.recruiterTake = recruiterTake; }
    public Instant getAnalyzedAt() { return analyzedAt; }
    public void setAnalyzedAt(Instant analyzedAt) { this.analyzedAt = analyzedAt; }
}
