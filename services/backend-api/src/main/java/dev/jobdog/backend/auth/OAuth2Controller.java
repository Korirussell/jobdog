package dev.jobdog.backend.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/oauth2")
public class OAuth2Controller {

    private final OAuth2Service oAuth2Service;

    public OAuth2Controller(OAuth2Service oAuth2Service) {
        this.oAuth2Service = oAuth2Service;
    }

    @GetMapping("/callback/{provider}")
    public ResponseEntity<AuthResponse> handleOAuth2Callback(
            @PathVariable String provider,
            @AuthenticationPrincipal OAuth2User oAuth2User
    ) {
        if (oAuth2User == null) {
            throw new IllegalStateException("OAuth2 authentication failed");
        }

        AuthResponse response = oAuth2Service.processOAuth2Login(provider, oAuth2User);
        return ResponseEntity.ok(response);
    }
}
