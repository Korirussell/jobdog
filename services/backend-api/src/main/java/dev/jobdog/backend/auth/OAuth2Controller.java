package dev.jobdog.backend.auth;

import dev.jobdog.backend.config.AppOAuthProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/auth/oauth2")
public class OAuth2Controller {

    private final OAuth2Service oAuth2Service;
    private final AppOAuthProperties oAuthProperties;

    public OAuth2Controller(OAuth2Service oAuth2Service, AppOAuthProperties oAuthProperties) {
        this.oAuth2Service = oAuth2Service;
        this.oAuthProperties = oAuthProperties;
    }

    // Callback route is handled by Spring Security OAuth2 filter.
    // This endpoint only exists to prevent 404 when hit directly.
    @GetMapping("/callback/{provider}")
    public ResponseEntity<String> callbackInfo(@PathVariable String provider) {
        return ResponseEntity.ok("OAuth2 callback received for provider: " + provider);
    }

    /**
     * After Spring Security completes the OAuth2 handshake, it redirects here.
     * We issue a JWT and redirect the browser to the frontend /auth/callback page
     * with the token as a query parameter so the frontend can store it.
     */
    @GetMapping("/success")
    public ResponseEntity<Void> handleOAuth2Success(
            Authentication authentication,
            @AuthenticationPrincipal OAuth2User oAuth2User
    ) {
        if (oAuth2User == null) {
            String frontendBase = oAuthProperties.frontendBaseUrl();
            HttpHeaders headers = new HttpHeaders();
            headers.setLocation(URI.create(frontendBase + "/login?error=oauth_failed"));
            return new ResponseEntity<>(headers, HttpStatus.FOUND);
        }

        String provider = "oauth2";
        if (authentication instanceof OAuth2AuthenticationToken token) {
            provider = token.getAuthorizedClientRegistrationId();
        }

        AuthResponse response = oAuth2Service.processOAuth2Login(provider, oAuth2User);

        String frontendBase = oAuthProperties.frontendBaseUrl();
        String redirectUrl = frontendBase + "/auth/callback?token=" + response.token()
                + "&userId=" + response.userId()
                + "&email=" + java.net.URLEncoder.encode(response.email(), java.nio.charset.StandardCharsets.UTF_8)
                + "&displayName=" + java.net.URLEncoder.encode(response.displayName(), java.nio.charset.StandardCharsets.UTF_8);

        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(URI.create(redirectUrl));
        return new ResponseEntity<>(headers, HttpStatus.FOUND);
    }
}
