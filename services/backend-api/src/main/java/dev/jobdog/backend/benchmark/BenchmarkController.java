package dev.jobdog.backend.benchmark;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/jobs/benchmarks")
public class BenchmarkController {

    private final BenchmarkService benchmarkService;

    public BenchmarkController(BenchmarkService benchmarkService) {
        this.benchmarkService = benchmarkService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getBenchmarks() {
        List<BenchmarkJobEntity> benchmarks = benchmarkService.getAllBenchmarks();
        
        List<Map<String, Object>> items = benchmarks.stream().map(b -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("benchmarkId", b.getId());
            m.put("title", b.getTitle());
            m.put("company", b.getCompany());
            m.put("category", b.getCategory());
            m.put("description", b.getDescription());
            m.put("difficultyLevel", b.getDifficultyLevel());
            return m;
        }).toList();

        return ResponseEntity.ok(Map.of("items", items));
    }
}
