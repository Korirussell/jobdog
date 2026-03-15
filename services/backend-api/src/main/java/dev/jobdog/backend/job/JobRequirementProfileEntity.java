package dev.jobdog.backend.job;

import dev.jobdog.backend.common.persistence.BaseEntity;
import dev.jobdog.backend.common.persistence.StringListConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import java.util.List;

@Entity
@Table(name = "job_requirement_profiles")
public class JobRequirementProfileEntity extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_id", nullable = false, unique = true)
    private JobEntity job;

    @Convert(converter = StringListConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<String> requiredSkills;

    @Convert(converter = StringListConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<String> preferredSkills;

    @Column(nullable = false, length = 64)
    private String extractionMethod;

    public JobEntity getJob() {
        return job;
    }

    public void setJob(JobEntity job) {
        this.job = job;
    }

    public List<String> getRequiredSkills() {
        return requiredSkills;
    }

    public void setRequiredSkills(List<String> requiredSkills) {
        this.requiredSkills = requiredSkills;
    }

    public List<String> getPreferredSkills() {
        return preferredSkills;
    }

    public void setPreferredSkills(List<String> preferredSkills) {
        this.preferredSkills = preferredSkills;
    }

    public String getExtractionMethod() {
        return extractionMethod;
    }

    public void setExtractionMethod(String extractionMethod) {
        this.extractionMethod = extractionMethod;
    }
}
