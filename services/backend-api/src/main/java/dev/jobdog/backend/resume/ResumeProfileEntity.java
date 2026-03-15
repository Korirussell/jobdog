package dev.jobdog.backend.resume;

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
@Table(name = "resume_profiles")
public class ResumeProfileEntity extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "resume_id", nullable = false, unique = true)
    private ResumeEntity resume;

    @Convert(converter = StringListConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<String> skills;

    @Column
    private Integer yearsExperience;

    @Column(length = 64)
    private String educationLevel;

    @Column(length = 64)
    private String rawTextChecksum;

    @Column(length = 64)
    private String parserProvider;

    @Column(length = 64)
    private String parserModel;

    public ResumeEntity getResume() {
        return resume;
    }

    public void setResume(ResumeEntity resume) {
        this.resume = resume;
    }

    public List<String> getSkills() {
        return skills;
    }

    public void setSkills(List<String> skills) {
        this.skills = skills;
    }

    public Integer getYearsExperience() {
        return yearsExperience;
    }

    public void setYearsExperience(Integer yearsExperience) {
        this.yearsExperience = yearsExperience;
    }

    public String getEducationLevel() {
        return educationLevel;
    }

    public void setEducationLevel(String educationLevel) {
        this.educationLevel = educationLevel;
    }

    public String getRawTextChecksum() {
        return rawTextChecksum;
    }

    public void setRawTextChecksum(String rawTextChecksum) {
        this.rawTextChecksum = rawTextChecksum;
    }

    public String getParserProvider() {
        return parserProvider;
    }

    public void setParserProvider(String parserProvider) {
        this.parserProvider = parserProvider;
    }

    public String getParserModel() {
        return parserModel;
    }

    public void setParserModel(String parserModel) {
        this.parserModel = parserModel;
    }
}
