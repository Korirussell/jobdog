package dev.jobdog.backend.auth;

import dev.jobdog.backend.config.AppJwtProperties;
import dev.jobdog.backend.user.UserEntity;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {

    private final AppJwtProperties properties;

    public JwtService(AppJwtProperties properties) {
        this.properties = properties;
    }

    public String generateToken(UserEntity user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(properties.expiration());
        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey())
                .compact();
    }

    public Instant expirationInstant() {
        return Instant.now().plus(properties.expiration());
    }

    public UUID extractUserId(String token) {
        return UUID.fromString(parseClaims(token).getSubject());
    }

    public boolean isTokenValid(String token, UserEntity user) {
        Claims claims = parseClaims(token);
        return user.getId().toString().equals(claims.getSubject())
                && claims.getExpiration().toInstant().isAfter(Instant.now());
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey signingKey() {
        return Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
    }
}
