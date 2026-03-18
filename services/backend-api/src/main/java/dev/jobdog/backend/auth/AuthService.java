package dev.jobdog.backend.auth;

import dev.jobdog.backend.user.UserEntity;
import dev.jobdog.backend.user.UserRepository;
import dev.jobdog.backend.user.UserRole;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email is already registered");
        }

        UserEntity user = new UserEntity();
        user.setEmail(request.email().trim().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName().trim());
        user.setRole(UserRole.USER);

        UserEntity savedUser = userRepository.save(user);
        String token = jwtService.generateToken(savedUser);
        return new AuthResponse(savedUser.getId(), savedUser.getEmail(), savedUser.getDisplayName(), token, jwtService.expirationInstant());
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        UserEntity user = userRepository.findByEmail(request.email().trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        String token = jwtService.generateToken(user);
        return new AuthResponse(user.getId(), user.getEmail(), user.getDisplayName(), token, jwtService.expirationInstant());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getUserProfile(UUID userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Map<String, Object> profile = new HashMap<>();
        profile.put("userId", user.getId());
        profile.put("email", user.getEmail());
        profile.put("displayName", user.getDisplayName());
        profile.put("profileVisibility", user.getProfileVisibility());
        return profile;
    }
}
