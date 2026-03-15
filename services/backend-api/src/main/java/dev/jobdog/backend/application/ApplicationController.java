package dev.jobdog.backend.application;

import dev.jobdog.backend.auth.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/jobs/{jobId}/applications")
public class ApplicationController {

    private final ApplicationService applicationService;
    private final CurrentUser currentUser;

    public ApplicationController(ApplicationService applicationService,
                                  CurrentUser currentUser) {
        this.applicationService = applicationService;
        this.currentUser = currentUser;
    }

    @PostMapping
    public ResponseEntity<ApplicationResponse> createApplication(@PathVariable UUID jobId,
                                                                 @Valid @RequestBody CreateApplicationRequest request) {
        return ResponseEntity.ok(applicationService.createApplication(jobId, currentUser.require().userId(), request));
    }
}
