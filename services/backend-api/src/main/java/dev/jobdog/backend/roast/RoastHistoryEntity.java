package dev.jobdog.backend.roast;

import dev.jobdog.backend.common.persistence.BaseEntity;
import dev.jobdog.backend.common.persistence.StringListConverter;
import dev.jobdog.backend.job.JobEntity;
import dev.jobdog.backend.resume.ResumeEntity;
import dev.jobdog.backend.user.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.ColumnTransformer;

import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "roast_history")
public class RoastHistoryEntity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "resume_id", nullable = false)
    private ResumeEntity resume;

    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(name = "job_id", nullable = true)
    private JobEntity job;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String brutalRoastText;

    @Convert(converter = StringListConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    @ColumnTransformer(write = "?::jsonb")
    private List<String> missingDependencies;

    @Column(nullable = false)
    private Integer topDogRank;

    @Column(nullable = false, length = 64)
    private String tierName;

    @Column(nullable = false)
    private Instant roastedAt;

    public UserEntity getUser() { return user; }
    public void setUser(UserEntity user) { this.user = user; }
    public ResumeEntity getResume() { return resume; }
    public void setResume(ResumeEntity resume) { this.resume = resume; }
    public JobEntity getJob() { return job; }
    public void setJob(JobEntity job) { this.job = job; }
    public String getBrutalRoastText() { return brutalRoastText; }
    public void setBrutalRoastText(String brutalRoastText) { this.brutalRoastText = brutalRoastText; }
    public List<String> getMissingDependencies() { return missingDependencies; }
    public void setMissingDependencies(List<String> missingDependencies) { this.missingDependencies = missingDependencies; }
    public Integer getTopDogRank() { return topDogRank; }
    public void setTopDogRank(Integer topDogRank) { this.topDogRank = topDogRank; }
    public String getTierName() { return tierName; }
    public void setTierName(String tierName) { this.tierName = tierName; }
    public Instant getRoastedAt() { return roastedAt; }
    public void setRoastedAt(Instant roastedAt) { this.roastedAt = roastedAt; }
}
