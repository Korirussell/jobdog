package dev.jobdog.backend.application;

import dev.jobdog.backend.auth.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/applications")
public class UserApplicationController {

    private final ApplicationService applicationService;
    private final CurrentUser currentUser;

    public UserApplicationController(ApplicationService applicationService, CurrentUser currentUser) {
        this.applicationService = applicationService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ResponseEntity<List<ApplicationListItem>> listApplications() {
        UUID userId = currentUser.require().userId();
        return ResponseEntity.ok(applicationService.listApplications(userId));
    }

    @PatchMapping("/{applicationId}/status")
    public ResponseEntity<Void> updateStatus(@PathVariable UUID applicationId,
                                              @RequestBody Map<String, String> body) {
        String newStatus = body.get("status");
        if (newStatus == null || newStatus.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        applicationService.updateStatus(applicationId, currentUser.require().userId(), newStatus);
        return ResponseEntity.noContent().build();
    }
}
