package dev.jobdog.backend.auth;

import dev.jobdog.backend.config.AppOAuthProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Runs in the SAME request as the OAuth2 callback — no second redirect needed.
 * Generates a JWT and sends the browser straight to the frontend /auth/callback
 * page with the token in the query string.
 *
 * This avoids the session-loss problem where oAuth2User is null on the /success
 * endpoint because the session cookie doesn't survive the proxy hop.
 */
@Component
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final OAuth2Service oAuth2Service;
    private final AppOAuthProperties oAuthProperties;

    public OAuth2SuccessHandler(OAuth2Service oAuth2Service, AppOAuthProperties oAuthProperties) {
        this.oAuth2Service = oAuth2Service;
        this.oAuthProperties = oAuthProperties;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        if (!(authentication instanceof OAuth2AuthenticationToken token)) {
            response.sendRedirect(oAuthProperties.frontendBaseUrl() + "/login?error=oauth_failed");
            return;
        }

        OAuth2User oAuth2User = token.getPrincipal();
        String provider = token.getAuthorizedClientRegistrationId();

        try {
            AuthResponse authResponse = oAuth2Service.processOAuth2Login(provider, oAuth2User);

            String redirectUrl = oAuthProperties.frontendBaseUrl() + "/auth/callback"
                    + "?token=" + URLEncoder.encode(authResponse.token(), StandardCharsets.UTF_8)
                    + "&userId=" + authResponse.userId()
                    + "&email=" + URLEncoder.encode(authResponse.email(), StandardCharsets.UTF_8)
                    + "&displayName=" + URLEncoder.encode(authResponse.displayName(), StandardCharsets.UTF_8);

            clearAuthenticationAttributes(request);
            getRedirectStrategy().sendRedirect(request, response, redirectUrl);
        } catch (Exception e) {
            response.sendRedirect(oAuthProperties.frontendBaseUrl() + "/login?error=oauth_failed");
        }
    }
}
