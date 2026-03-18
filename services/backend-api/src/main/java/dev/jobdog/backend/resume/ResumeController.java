package dev.jobdog.backend.resume;

import dev.jobdog.backend.auth.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/resumes")
public class ResumeController {

    private final ResumeService resumeService;
    private final CurrentUser currentUser;

    public ResumeController(ResumeService resumeService,
                            CurrentUser currentUser) {
        this.resumeService = resumeService;
        this.currentUser = currentUser;
    }

    @PostMapping
    public ResponseEntity<ResumeUploadResponse> uploadResume(@RequestParam("file") MultipartFile file,
                                                             @RequestParam(value = "label", required = false) String label) {
        return ResponseEntity.ok(resumeService.uploadResume(currentUser.require(), file, label));
    }

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
