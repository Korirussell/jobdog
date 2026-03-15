package dev.jobdog.backend.resume;

import dev.jobdog.backend.auth.AuthenticatedUser;
import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class ResumeService {

    private final ResumeRepository resumeRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final ResumeParsingService resumeParsingService;

    public ResumeService(ResumeRepository resumeRepository,
                         UserRepository userRepository,
                         StorageService storageService,
                         ResumeParsingService resumeParsingService) {
        this.resumeRepository = resumeRepository;
        this.userRepository = userRepository;
        this.storageService = storageService;
        this.resumeParsingService = resumeParsingService;
    }

    @Transactional
    public ResumeUploadResponse uploadResume(AuthenticatedUser authenticatedUser,
                                             MultipartFile file,
                                             String label) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Resume file is required");
        }
        if (!"application/pdf".equalsIgnoreCase(file.getContentType())) {
            throw new IllegalArgumentException("Only PDF resumes are supported");
        }

        UserEntity user = userRepository.findById(authenticatedUser.userId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        byte[] bytes = readBytes(file);
        String checksum = sha256(bytes);
        String storageKey = buildStorageKey(user.getId(), file.getOriginalFilename());
        storageService.putObject(storageKey, file.getContentType(), bytes);

        ResumeEntity resume = new ResumeEntity();
        resume.setUser(user);
        resume.setLabel(label == null || label.isBlank() ? "default" : label.trim());
        resume.setStorageKey(storageKey);
        resume.setOriginalFilename(file.getOriginalFilename() == null ? "resume.pdf" : file.getOriginalFilename());
        resume.setContentType(file.getContentType());
        resume.setFileSizeBytes(bytes.length);
        resume.setChecksumSha256(checksum);
        resume.setStatus(ResumeStatus.UPLOADED);
        resume.setUploadedAt(Instant.now());

        ResumeEntity saved = resumeRepository.save(resume);
        
        resumeParsingService.parseResumeAsync(saved.getId(), bytes);
        
        return new ResumeUploadResponse(saved.getId(), saved.getStatus().name(), saved.getStorageKey(), saved.getUploadedAt());
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to read uploaded file", exception);
        }
    }

    private String buildStorageKey(UUID userId, String originalFilename) {
        String safeName = (originalFilename == null || originalFilename.isBlank() ? "resume.pdf" : originalFilename)
                .replaceAll("[^a-zA-Z0-9._-]", "-");
        return "resumes/" + userId + "/" + UUID.randomUUID() + "-" + safeName;
    }

    private String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 digest is unavailable", exception);
        }
    }
}
