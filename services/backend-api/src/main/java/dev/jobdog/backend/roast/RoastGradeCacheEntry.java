package dev.jobdog.backend.roast;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

public record RoastGradeCacheEntry(
        int topDogRank,
        String tierName,
        Map<String, Double> subScores,
        List<String> topPros,
        String brutalRoastText,
        List<String> missingDependencies
) implements Serializable {
}
