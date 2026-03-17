package dev.jobdog.backend.health;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/health")
public class HealthController {

    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new HashMap<>();
        Map<String, String> checks = new HashMap<>();

        boolean dbHealthy = checkDatabase();
        checks.put("database", dbHealthy ? "UP" : "DOWN");

        String status = dbHealthy ? "UP" : "DOWN";
        response.put("status", status);
        response.put("timestamp", Instant.now());
        response.put("checks", checks);

        return dbHealthy
                ? ResponseEntity.ok(response)
                : ResponseEntity.status(503).body(response);
    }

    private boolean checkDatabase() {
        try (Connection conn = dataSource.getConnection()) {
            return conn.isValid(5);
        } catch (Exception e) {
            return false;
        }
    }
}
