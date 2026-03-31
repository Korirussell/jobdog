package dev.jobdog.backend.resume;

import dev.jobdog.backend.auth.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST controller for resume upload and management operations.
 * Handles PDF resume uploads with AI-powered parsing and profile extraction.
 * All endpoints require authentication.
 */
@RestController
@RequestMapping("/api/v1/resumes")
public class ResumeController {

    private final ResumeService resumeService;
    private final CurrentUser currentUser;

    /**
     * Constructor injection of dependencies (Spring DI pattern).
     * @param resumeService Business logic for resume operations
     * @param currentUser Thread-scoped authentication context
     */
    public ResumeController(ResumeService resumeService,
                            CurrentUser currentUser) {
        this.resumeService = resumeService;
        this.currentUser = currentUser;
    }

    /**
     * Uploads a PDF resume for parsing and profile extraction.
     * Validates PDF format, stores in Cloudflare R2, and triggers async AI parsing.
     * Parsing extracts skills, years of experience, and education level using OpenAI.
     * 
     * @param file PDF file (validated by magic bytes)
     * @param label Optional label for the resume (defaults to "default")
     * @return Upload confirmation with resume ID and status
     */
    @PostMapping
    public ResponseEntity<ResumeUploadResponse> uploadResume(@RequestParam("file") MultipartFile file,
                                                             @RequestParam(value = "label", required = false) String label) {
        return ResponseEntity.ok(resumeService.uploadResume(currentUser.require(), file, label));
    }

    /**
     * Deletes a resume and its associated storage object.
     * Verifies ownership before deletion.
     * 
     * @param resumeId Unique identifier for the resume
     * @return 204 No Content on success
     */
    @DeleteMapping("/{resumeId}")
    public ResponseEntity<Void> deleteResume(@PathVariable UUID resumeId) {
        resumeService.deleteResume(resumeId, currentUser.require().userId());
        return ResponseEntity.noContent().build();
    }

    /**
     * Lists all resumes for the authenticated user.
     * Returns resume metadata including upload status and parsing state.
     * 
     * @return List of resume summaries ordered by upload date (newest first)
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> listResumes() {
        List<ResumeEntity> resumes = resumeService.listResumes(currentUser.require().userId());
        List<Map<String, Object>> items = resumes.stream().map(r -> {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("resumeId", r.getId());
            m.put("label", r.getLabel());
            m.put("originalFilename", r.getOriginalFilename());
            m.put("status", r.getStatus().name());
            m.put("uploadedAt", r.getUploadedAt());
            return m;
        }).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }
}
