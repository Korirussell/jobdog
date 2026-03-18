package dev.jobdog.backend.auth;

import dev.jobdog.backend.config.AppOAuthProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * On OAuth2 failure, redirect the browser to the frontend login page
 * instead of Spring's default /login?error endpoint.
 */
@Component
public class OAuth2FailureHandler extends SimpleUrlAuthenticationFailureHandler {

    private final AppOAuthProperties oAuthProperties;

    public OAuth2FailureHandler(AppOAuthProperties oAuthProperties) {
        this.oAuthProperties = oAuthProperties;
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request,
                                        HttpServletResponse response,
                                        AuthenticationException exception) throws IOException {
        response.sendRedirect(oAuthProperties.frontendBaseUrl() + "/login?error=oauth_failed");
    }
}
