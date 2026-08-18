package dev.jobdog.backend.job;

import dev.jobdog.backend.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "jobs")
public class JobEntity extends BaseEntity {

    @Column(nullable = false, length = 64)
    private String source;

    @Column(length = 255)
    private String sourceJobId;

    @Column(nullable = false, unique = true)
    private String sourceUrl;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, length = 255)
    private String company;

    @Column(length = 255)
    private String location;

    @Column(length = 64)
    private String employmentType;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String descriptionText;

    @Column(nullable = false, length = 64)
    private String descriptionHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private JobStatus status;

    @Column
    private Integer minimumYearsExperience;

    @Column(length = 64)
    private String educationLevel;

    @Column(length = 16)
    private String experienceLevel;

    @Column(nullable = false, length = 24)
    private String roleCategory;

    @Column(nullable = false, length = 16)
    private String locationScope;

    @Column(length = 24)
    private String entryType;

    @Column
    private Short gradYearMin;

    @Column
    private Short gradYearMax;

    @Column(length = 8)
    private String gradSource;

    @Column
    private Float gradConfidence;

    @Column(columnDefinition = "TEXT")
    private String gradEvidence;

    @Column(columnDefinition = "TEXT")
    private String salaryRaw;

    @Column
    private Instant postedAt;

    @Column(nullable = false)
    private Instant scrapedAt;

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getSourceJobId() {
        return sourceJobId;
    }

    public void setSourceJobId(String sourceJobId) {
        this.sourceJobId = sourceJobId;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getCompany() {
        return company;
    }

    public void setCompany(String company) {
        this.company = company;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getEmploymentType() {
        return employmentType;
    }

    public void setEmploymentType(String employmentType) {
        this.employmentType = employmentType;
    }

    public String getDescriptionText() {
        return descriptionText;
    }

    public void setDescriptionText(String descriptionText) {
        this.descriptionText = descriptionText;
    }

    public String getDescriptionHash() {
        return descriptionHash;
    }

    public void setDescriptionHash(String descriptionHash) {
        this.descriptionHash = descriptionHash;
    }

    public JobStatus getStatus() {
        return status;
    }

    public void setStatus(JobStatus status) {
        this.status = status;
    }

    public Integer getMinimumYearsExperience() {
        return minimumYearsExperience;
    }

    public void setMinimumYearsExperience(Integer minimumYearsExperience) {
        this.minimumYearsExperience = minimumYearsExperience;
    }

    public String getEducationLevel() {
        return educationLevel;
    }

    public void setEducationLevel(String educationLevel) {
        this.educationLevel = educationLevel;
    }

    public String getExperienceLevel() {
        return experienceLevel;
    }

    public void setExperienceLevel(String experienceLevel) {
        this.experienceLevel = experienceLevel;
    }

    public String getRoleCategory() {
        return roleCategory;
    }

    public void setRoleCategory(String roleCategory) {
        this.roleCategory = roleCategory;
    }

    public String getLocationScope() {
        return locationScope;
    }

    public void setLocationScope(String locationScope) {
        this.locationScope = locationScope;
    }

    public String getEntryType() {
        return entryType;
    }

    public void setEntryType(String entryType) {
        this.entryType = entryType;
    }

    public Short getGradYearMin() {
        return gradYearMin;
    }

    public void setGradYearMin(Short gradYearMin) {
        this.gradYearMin = gradYearMin;
    }

    public Short getGradYearMax() {
        return gradYearMax;
    }

    public void setGradYearMax(Short gradYearMax) {
        this.gradYearMax = gradYearMax;
    }

    public String getGradSource() {
        return gradSource;
    }

    public void setGradSource(String gradSource) {
        this.gradSource = gradSource;
    }

    public Float getGradConfidence() {
        return gradConfidence;
    }

    public void setGradConfidence(Float gradConfidence) {
        this.gradConfidence = gradConfidence;
    }

    public String getGradEvidence() {
        return gradEvidence;
    }

    public void setGradEvidence(String gradEvidence) {
        this.gradEvidence = gradEvidence;
    }

    public String getSalaryRaw() {
        return salaryRaw;
    }

    public void setSalaryRaw(String salaryRaw) {
        this.salaryRaw = salaryRaw;
    }

    public Instant getPostedAt() {
        return postedAt;
    }

    public void setPostedAt(Instant postedAt) {
        this.postedAt = postedAt;
    }

    public Instant getScrapedAt() {
        return scrapedAt;
    }

    public void setScrapedAt(Instant scrapedAt) {
        this.scrapedAt = scrapedAt;
    }
}
