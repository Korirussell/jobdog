package dev.jobdog.backend.roast;

import dev.jobdog.backend.auth.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/roast")
public class RoastController {

    private final RoastService roastService;
    private final RoastHistoryRepository roastHistoryRepository;
    private final CurrentUser currentUser;

    public RoastController(RoastService roastService,
                           RoastHistoryRepository roastHistoryRepository,
                           CurrentUser currentUser) {
        this.roastService = roastService;
        this.roastHistoryRepository = roastHistoryRepository;
        this.currentUser = currentUser;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> roastResume(@RequestBody Map<String, String> body) {
        var userId = currentUser.require().userId();
        UUID resumeId = UUID.fromString(body.get("resumeId"));
        UUID jobId = UUID.fromString(body.get("jobId"));

        RoastHistoryEntity roast = roastService.roast(userId, resumeId, jobId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("brutalRoastText", roast.getBrutalRoastText());
        result.put("missingDependencies", roast.getMissingDependencies());
        result.put("topDogRank", roast.getTopDogRank());
        result.put("tierName", roast.getTierName());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/history")
    public ResponseEntity<Map<String, Object>> roastHistory() {
        var userId = currentUser.require().userId();
        List<RoastHistoryEntity> history = roastHistoryRepository.findByUser_IdOrderByRoastedAtDesc(userId);

        List<Map<String, Object>> items = history.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("roastId", r.getId());
            m.put("jobTitle", r.getJob().getTitle());
            m.put("company", r.getJob().getCompany());
            m.put("topDogRank", r.getTopDogRank());
            m.put("tierName", r.getTierName());
            m.put("roastedAt", r.getRoastedAt());
            return m;
        }).toList();

        return ResponseEntity.ok(Map.of("items", items));
    }
}
