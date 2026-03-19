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
import java.util.List;
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
        // Accept application/pdf and application/octet-stream (some browsers/OS send this for PDFs)
        // We validate it's actually a PDF by checking the magic bytes after reading
        String ct = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!ct.contains("pdf") && !ct.contains("octet-stream")) {
            throw new IllegalArgumentException("Only PDF files are supported (received: " + ct + ")");
        }

        UserEntity user = userRepository.findById(authenticatedUser.userId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        byte[] bytes = readBytes(file);

        // Validate PDF magic bytes (%PDF-)
        if (bytes.length < 5 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F') {
            throw new IllegalArgumentException("File does not appear to be a valid PDF");
        }

        String checksum = sha256(bytes);
        String storageKey = buildStorageKey(user.getId(), file.getOriginalFilename());

        // Upload to R2 — if it fails, log the error but continue so the user
        // can still get their resume parsed and roasted (bytes are passed directly
        // to the async parser, so R2 is not needed for that flow).
        try {
            storageService.putObject(storageKey, file.getContentType(), bytes);
        } catch (Exception storageEx) {
            org.slf4j.LoggerFactory.getLogger(ResumeService.class)
                    .error("R2 upload failed for user {} — continuing without remote storage: {}",
                            user.getId(), storageEx.getMessage(), storageEx);
            // Mark the key with a prefix so we know it was never persisted to R2
            storageKey = "local-fallback/" + storageKey;
        }

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

    public List<ResumeEntity> listResumes(UUID userId) {
        return resumeRepository.findByUser_IdOrderByUploadedAtDesc(userId);
    }

    @Transactional
    public void deleteResume(UUID resumeId, UUID userId) {
        ResumeEntity resume = resumeRepository.findById(resumeId)
                .orElseThrow(() -> new IllegalArgumentException("Resume not found"));
        if (!resume.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Resume does not belong to user");
        }
        // Best-effort R2 deletion — don't fail if storage delete fails
        if (resume.getStorageKey() != null && !resume.getStorageKey().startsWith("local-fallback/")) {
            try {
                storageService.deleteObject(resume.getStorageKey());
            } catch (Exception e) {
                org.slf4j.LoggerFactory.getLogger(ResumeService.class)
                        .warn("Failed to delete R2 object for resume {}: {}", resumeId, e.getMessage());
            }
        }
        resumeRepository.delete(resume);
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
