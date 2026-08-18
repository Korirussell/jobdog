package dev.jobdog.backend.battle;

import dev.jobdog.backend.resume.PdfTextExtractor;
import dev.jobdog.backend.resume.ResumeEntity;
import dev.jobdog.backend.resume.ResumeParsingService;
import dev.jobdog.backend.resume.ResumeProfileEntity;
import dev.jobdog.backend.resume.ResumeProfileRepository;
import dev.jobdog.backend.resume.ResumeRepository;
import dev.jobdog.backend.resume.StorageService;
import dev.jobdog.backend.roast.RoastGradeCacheEntry;
import dev.jobdog.backend.roast.RoastService;
import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;

@Service
public class BattleService {

    private static final String TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int TOKEN_LENGTH = 10;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final BattleChallengeRepository battleChallengeRepository;
    private final ResumeRepository resumeRepository;
    private final ResumeProfileRepository resumeProfileRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final PdfTextExtractor pdfTextExtractor;
    private final ResumeParsingService resumeParsingService;
    private final RoastService roastService;

    public BattleService(BattleChallengeRepository battleChallengeRepository,
                         ResumeRepository resumeRepository,
                         ResumeProfileRepository resumeProfileRepository,
                         UserRepository userRepository,
                         StorageService storageService,
                         PdfTextExtractor pdfTextExtractor,
                         ResumeParsingService resumeParsingService,
                         RoastService roastService) {
        this.battleChallengeRepository = battleChallengeRepository;
        this.resumeRepository = resumeRepository;
        this.resumeProfileRepository = resumeProfileRepository;
        this.userRepository = userRepository;
        this.storageService = storageService;
        this.pdfTextExtractor = pdfTextExtractor;
        this.resumeParsingService = resumeParsingService;
        this.roastService = roastService;
    }

    @Transactional
    public BattleChallengeEntity createChallenge(UUID userId, UUID resumeId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        ResumeEntity resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new IllegalArgumentException("Resume not found"));
        if (!resume.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Resume does not belong to user");
        }
        ResumeProfileEntity profile = resumeProfileRepository.findByResume_Id(resumeId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Resume must be fully parsed before starting a battle. Current status: " + resume.getStatus()));

        String resumeText = extractText(resume.getStorageKey());
        RoastGradeCacheEntry grade = roastService.gradeGeneralResumeText(
                resumeText, profile.getSkills(), profile.getYearsExperience(), profile.getEducationLevel());

        BattleChallengeEntity challenge = new BattleChallengeEntity();
        challenge.setToken(generateUniqueToken());
        challenge.setCreatorUserId(userId);
        challenge.setCreatorResumeId(resumeId);
        challenge.setCreatorLabel(displayLabel(user.getDisplayName()));
        challenge.setCreatorTopDogRank(grade.topDogRank());
        challenge.setCreatorTierName(grade.tierName());
        challenge.setCreatorSubScores(grade.subScores());
        challenge.setStatus("WAITING");

        return battleChallengeRepository.save(challenge);
    }

    public BattleChallengeEntity getByToken(String token) {
        return battleChallengeRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Battle not found"));
    }

    /**
     * Scores the challenger's upload and settles the battle. A token accepts
     * exactly one challenger — this is deliberate, not a limitation to lift
     * later: a link that could be re-challenged indefinitely would let someone
     * keep re-rolling until they win, which defeats the point of a single
     * head-to-head comparison.
     */
    @Transactional
    public BattleChallengeEntity submitChallenge(String token, MultipartFile file, String challengerName) {
        BattleChallengeEntity challenge = battleChallengeRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Battle not found"));
        if (!"WAITING".equals(challenge.getStatus())) {
            throw new IllegalStateException("This battle already has a result");
        }

        byte[] bytes = validateAndReadPdf(file);
        String resumeText = pdfTextExtractor.extractText(bytes);
        ResumeParsingService.ExtractedProfile profile = resumeParsingService.extractProfile(resumeText);
        RoastGradeCacheEntry grade = roastService.gradeGeneralResumeText(
                resumeText, profile.skills(), profile.yearsExperience(), profile.educationLevel());

        challenge.setChallengerLabel(displayLabel(challengerName));
        challenge.setChallengerTopDogRank(grade.topDogRank());
        challenge.setChallengerTierName(grade.tierName());
        challenge.setChallengerSubScores(grade.subScores());
        challenge.setStatus("COMPLETE");
        challenge.setCompletedAt(Instant.now());

        return battleChallengeRepository.save(challenge);
    }

    private String extractText(String storageKey) {
        byte[] bytes = storageService.getObject(storageKey);
        return pdfTextExtractor.extractText(bytes);
    }

    private byte[] validateAndReadPdf(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Resume file is required");
        }
        String ct = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!ct.contains("pdf") && !ct.contains("octet-stream")) {
            throw new IllegalArgumentException("Only PDF files are supported (received: " + ct + ")");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded file", e);
        }
        if (bytes.length < 5 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F') {
            throw new IllegalArgumentException("File does not appear to be a valid PDF");
        }
        return bytes;
    }

    private String displayLabel(String name) {
        if (name == null || name.isBlank()) return "Anonymous";
        return name.trim().length() > 120 ? name.trim().substring(0, 120) : name.trim();
    }

    private String generateUniqueToken() {
        for (int attempt = 0; attempt < 5; attempt++) {
            String candidate = randomToken();
            if (battleChallengeRepository.findByToken(candidate).isEmpty()) {
                return candidate;
            }
        }
        throw new IllegalStateException("Failed to generate a unique battle token");
    }

    private String randomToken() {
        StringBuilder sb = new StringBuilder(TOKEN_LENGTH);
        for (int i = 0; i < TOKEN_LENGTH; i++) {
            sb.append(TOKEN_ALPHABET.charAt(RANDOM.nextInt(TOKEN_ALPHABET.length())));
        }
        return sb.toString();
    }
}
