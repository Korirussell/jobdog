package dev.jobdog.backend.battle;

import dev.jobdog.backend.auth.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
public class BattleController {

    private final BattleService battleService;
    private final CurrentUser currentUser;

    public BattleController(BattleService battleService, CurrentUser currentUser) {
        this.battleService = battleService;
        this.currentUser = currentUser;
    }

    /** Authenticated: pick one of your own resumes and mint a share link. */
    @PostMapping("/api/v1/battles")
    public ResponseEntity<Map<String, Object>> createBattle(@RequestBody Map<String, String> body) {
        var userId = currentUser.require().userId();
        UUID resumeId = UUID.fromString(body.get("resumeId"));
        try {
            BattleChallengeEntity challenge = battleService.createChallenge(userId, resumeId);
            // The creator always sees their own score — there's no one to spoil it
            // for yet. Only the public-facing view (below) withholds it.
            return ResponseEntity.ok(toResponse(challenge, true));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    /**
     * Public: fetch a battle by its share token. No auth — this is the whole
     * point of a link. Withholds the creator's score while WAITING so opening
     * your own link doesn't spoil the reveal, and so a challenger can't see
     * the score they need to beat before submitting.
     */
    @GetMapping("/api/v1/public/battles/{token}")
    public ResponseEntity<Map<String, Object>> getBattle(@PathVariable String token) {
        try {
            BattleChallengeEntity challenge = battleService.getByToken(token);
            return ResponseEntity.ok(toResponse(challenge, false));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    /** Public: the challenger's upload. Settles the battle for good — see BattleService.submitChallenge. */
    @PostMapping("/api/v1/public/battles/{token}/challenge")
    public ResponseEntity<Map<String, Object>> submitChallenge(
            @PathVariable String token,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "name", required = false) String name
    ) {
        try {
            BattleChallengeEntity challenge = battleService.submitChallenge(token, file, name);
            // Always COMPLETE by the time this returns, so revealCreatorScore is moot.
            return ResponseEntity.ok(toResponse(challenge, true));
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    private Map<String, Object> toResponse(BattleChallengeEntity c, boolean revealCreatorScore) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("token", c.getToken());
        result.put("status", c.getStatus());
        result.put("creatorLabel", c.getCreatorLabel());
        boolean complete = "COMPLETE".equals(c.getStatus());
        if (complete || revealCreatorScore) {
            result.put("creatorTopDogRank", c.getCreatorTopDogRank());
            result.put("creatorTierName", c.getCreatorTierName());
            result.put("creatorSubScores", c.getCreatorSubScores());
        }
        if (complete) {
            result.put("challengerLabel", c.getChallengerLabel());
            result.put("challengerTopDogRank", c.getChallengerTopDogRank());
            result.put("challengerTierName", c.getChallengerTierName());
            result.put("challengerSubScores", c.getChallengerSubScores());
            result.put("completedAt", c.getCompletedAt());
        }
        return result;
    }
}
