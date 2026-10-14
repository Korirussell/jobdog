package dev.jobdog.backend.user;

import dev.jobdog.backend.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "users")
public class UserEntity extends BaseEntity {

    @Column(nullable = false, unique = true, length = 320)
    private String email;

    @Column(nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 120)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private UserRole role = UserRole.USER;

    @Column(nullable = false, length = 16)
    private String profileVisibility = "PRIVATE";

    /** Resume uploads left. Metered because parsing and analysis call an LLM; earned back by confirming job links. */
    @Column(nullable = false)
    private int resumeCredits = 3;

    /** Job-link confirmations counted toward the next credit. */
    @Column(nullable = false)
    private int reportCreditProgress = 0;

    @Column
    private Instant lastSeenAt;

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public String getProfileVisibility() {
        return profileVisibility;
    }

    public void setProfileVisibility(String profileVisibility) {
        this.profileVisibility = profileVisibility;
    }

    public int getResumeCredits() {
        return resumeCredits;
    }

    public int getReportCreditProgress() {
        return reportCreditProgress;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }
}
