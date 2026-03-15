package dev.jobdog.backend.system;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/system")
public class SystemController {

    @GetMapping("/health")
    public ResponseEntity<SystemHealthResponse> health() {
        return ResponseEntity.ok(new SystemHealthResponse("backend-api", "UP", Instant.now()));
    }
}
