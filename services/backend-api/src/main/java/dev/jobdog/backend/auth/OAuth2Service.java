package dev.jobdog.backend.auth;

import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
public class OAuth2Service {

    private final UserRepository userRepository;
    private final JwtService jwtService;

    public OAuth2Service(UserRepository userRepository, JwtService jwtService) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse processOAuth2Login(String provider, OAuth2User oAuth2User) {
        String email = extractEmail(provider, oAuth2User);
        String name = extractName(provider, oAuth2User);

        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email not provided by OAuth2 provider");
        }

        UserEntity user = userRepository.findByEmail(email)
                .orElseGet(() -> createUserFromOAuth2(email, name, provider));

        String token = jwtService.generateToken(user);
        Instant expiresAt = jwtService.expirationInstant();

        return new AuthResponse(user.getId(), user.getEmail(), user.getEmail(), token, expiresAt);
    }

    private UserEntity createUserFromOAuth2(String email, String name, String provider) {
        UserEntity user = new UserEntity();
        user.setEmail(email);
        user.setPasswordHash(""); // OAuth users don't have passwords
        return userRepository.save(user);
    }

    private String extractEmail(String provider, OAuth2User oAuth2User) {
        Map<String, Object> attributes = oAuth2User.getAttributes();
        
        if ("google".equalsIgnoreCase(provider)) {
            return (String) attributes.get("email");
        } else if ("github".equalsIgnoreCase(provider)) {
            // GitHub might return email in the attributes or we might need to fetch it
            String email = (String) attributes.get("email");
            if (email == null || email.isBlank()) {
                // Try to get from login + @users.noreply.github.com
                String login = (String) attributes.get("login");
                if (login != null) {
                    email = login + "@users.noreply.github.com";
                }
            }
            return email;
        }
        
        return (String) attributes.get("email");
    }

    private String extractName(String provider, OAuth2User oAuth2User) {
        Map<String, Object> attributes = oAuth2User.getAttributes();
        
        if ("google".equalsIgnoreCase(provider)) {
            return (String) attributes.get("name");
        } else if ("github".equalsIgnoreCase(provider)) {
            String name = (String) attributes.get("name");
            if (name == null || name.isBlank()) {
                name = (String) attributes.get("login");
            }
            return name;
        }
        
        return (String) attributes.get("name");
    }
}
