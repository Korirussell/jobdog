package dev.jobdog.backend.battle;

import dev.jobdog.backend.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "battle_challenges")
public class BattleChallengeEntity extends BaseEntity {

    @Column(nullable = false, length = 24)
    private String token;

    @Column(nullable = false)
    private UUID creatorUserId;

    @Column(nullable = false)
    private UUID creatorResumeId;

    @Column(nullable = false, length = 120)
    private String creatorLabel;

    @Column(nullable = false)
    private int creatorTopDogRank;

    @Column(nullable = false, length = 32)
    private String creatorTierName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Double> creatorSubScores;

    @Column(length = 120)
    private String challengerLabel;

    private Integer challengerTopDogRank;

    @Column(length = 32)
    private String challengerTierName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Double> challengerSubScores;

    @Column(nullable = false, length = 16)
    private String status = "WAITING";

    private Instant completedAt;

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public UUID getCreatorUserId() { return creatorUserId; }
    public void setCreatorUserId(UUID creatorUserId) { this.creatorUserId = creatorUserId; }
    public UUID getCreatorResumeId() { return creatorResumeId; }
    public void setCreatorResumeId(UUID creatorResumeId) { this.creatorResumeId = creatorResumeId; }
    public String getCreatorLabel() { return creatorLabel; }
    public void setCreatorLabel(String creatorLabel) { this.creatorLabel = creatorLabel; }
    public int getCreatorTopDogRank() { return creatorTopDogRank; }
    public void setCreatorTopDogRank(int creatorTopDogRank) { this.creatorTopDogRank = creatorTopDogRank; }
    public String getCreatorTierName() { return creatorTierName; }
    public void setCreatorTierName(String creatorTierName) { this.creatorTierName = creatorTierName; }
    public Map<String, Double> getCreatorSubScores() { return creatorSubScores; }
    public void setCreatorSubScores(Map<String, Double> creatorSubScores) { this.creatorSubScores = creatorSubScores; }
    public String getChallengerLabel() { return challengerLabel; }
    public void setChallengerLabel(String challengerLabel) { this.challengerLabel = challengerLabel; }
    public Integer getChallengerTopDogRank() { return challengerTopDogRank; }
    public void setChallengerTopDogRank(Integer challengerTopDogRank) { this.challengerTopDogRank = challengerTopDogRank; }
    public String getChallengerTierName() { return challengerTierName; }
    public void setChallengerTierName(String challengerTierName) { this.challengerTierName = challengerTierName; }
    public Map<String, Double> getChallengerSubScores() { return challengerSubScores; }
    public void setChallengerSubScores(Map<String, Double> challengerSubScores) { this.challengerSubScores = challengerSubScores; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
}
