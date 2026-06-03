package com.tribo.api;

import com.tribo.api.error.ConflictException;
import com.tribo.api.error.ForbiddenException;
import com.tribo.api.error.UnauthorizedException;
import com.tribo.api.error.ValidationException;
import com.tribo.api.iam.JwtIssuer;
import com.tribo.api.iam.LoginRequest;
import com.tribo.api.iam.PasswordHasher;
import com.tribo.api.iam.PublicEndpoint;
import com.tribo.api.iam.RefreshRequest;
import com.tribo.api.iam.RegisterRequest;
import com.tribo.api.iam.RevokedTokenRepository;
import com.tribo.api.iam.Role;
import com.tribo.api.iam.User;
import com.tribo.api.iam.UserRepository;

import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Authentication endpoints.
 *
 *   POST /rest/auth/register — create a new END_USER account.   (B-6)
 *   POST /rest/auth/login    — exchange credentials for tokens.  (B-7)
 *   POST /rest/auth/refresh  — exchange a refresh token for a new access token. (B-7)
 *   POST /rest/auth/logout   — revoke a refresh token.           (B-8)
 *
 * Public (no auth required): the B-5 JwtAuthFilter skips the whole class via
 * @PublicEndpoint. Each endpoint authenticates by what it carries
 * (credentials, or a refresh token), not by an access-token header.
 */
@Path("/auth")
@PublicEndpoint
public class AuthResource {

    private static final UserRepository USERS = new UserRepository();
    private static final RevokedTokenRepository REVOKED = new RevokedTokenRepository();
    private static final JwtIssuer JWT = new JwtIssuer();

    // Dummy hash so the "no such user" login path still runs a bcrypt verify,
    // keeping response timing independent of whether the email exists.
    private static final String DUMMY_HASH = PasswordHasher.hash("dummy-password-placeholder");

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final int MIN_AGE = 13;
    private static final int MAX_AGE = 120;

    // --- B-6: register ---------------------------------------------------

    @POST
    @Path("/register")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response register(RegisterRequest req) {
        if (req == null) {
            throw new ValidationException("Request body is required.");
        }

        String email = req.email == null ? null : req.email.trim().toLowerCase();
        String fullName = req.fullName == null ? null : req.fullName.trim();
        String phone = req.phoneNumber == null ? null : req.phoneNumber.trim();

        if (email == null || !EMAIL.matcher(email).matches()) {
            throw new ValidationException("A valid email is required.");
        }
        if (req.password == null || req.password.length() < MIN_PASSWORD_LENGTH) {
            throw new ValidationException(
                    "Password must be at least " + MIN_PASSWORD_LENGTH + " characters.");
        }
        if (fullName == null || fullName.isEmpty()) {
            throw new ValidationException("Full name is required.");
        }
        if (phone == null || phone.isEmpty()) {
            throw new ValidationException("Phone number is required.");
        }
        if (req.age == null || req.age < MIN_AGE || req.age > MAX_AGE) {
            throw new ValidationException(
                    "Age must be between " + MIN_AGE + " and " + MAX_AGE + ".");
        }

        if (USERS.existsByEmail(email)) {
            throw new ConflictException("An account with this email already exists.");
        }

        // D-1: self-selected role, constrained server-side.
        Role role = resolveRequestedRole(req.role);
        boolean verified;
        String bootstrapEmail = System.getenv("BOOTSTRAP_ADMIN_EMAIL");
        if (bootstrapEmail != null && email.equalsIgnoreCase(bootstrapEmail.trim())) {
            // One-time seed: the configured email is created as a verified
            // SYSADMIN so there is a privileged account to verify the rest.
            role = Role.SYSADMIN;
            verified = true;
        } else {
            // END_USER is usable immediately; privileged roles await backoffice
            // verification before they can act (e.g. create activities).
            verified = (role == Role.END_USER);
        }

        String userId = UUID.randomUUID().toString();
        User user = new User(
                userId,
                email,
                PasswordHasher.hash(req.password),
                fullName,
                phone,
                req.age,
                role,
                User.ProfileVisibility.PUBLIC,
                Instant.now(),
                false,
                verified,
                null            // new users start without a clan (D-3)
        );
        USERS.save(user);

        return Response.created(URI.create("/rest/users/" + userId))
                .entity(Map.of(
                        "userId", userId,
                        "email", email,
                        "role", user.role().name(),
                        "verified", user.verified()
                ))
                .build();
    }

    /** Roles a user may pick at registration. Privileged roles are excluded. */
    private static final java.util.Set<Role> SELF_REGISTERABLE =
            java.util.EnumSet.of(Role.END_USER, Role.ACTIVITY_MANAGER, Role.PARTNER);

    /**
     * Parse and validate the requested role. Null/blank defaults to END_USER.
     * An unknown role is a 400; a known-but-privileged role (BACKOFFICE,
     * SYSADMIN) is a 403 — those are never self-assignable.
     */
    private static Role resolveRequestedRole(String requested) {
        if (requested == null || requested.isBlank()) {
            return Role.END_USER;
        }
        Role role;
        try {
            role = Role.valueOf(requested.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ValidationException("Unknown role: " + requested);
        }
        if (!SELF_REGISTERABLE.contains(role)) {
            throw new ForbiddenException("That role cannot be self-registered.");
        }
        return role;
    }

    // --- B-7: login ------------------------------------------------------

    @POST
    @Path("/login")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response login(LoginRequest req) {
        if (req == null || req.email == null || req.password == null) {
            throw new UnauthorizedException("Invalid email or password.");
        }

        String email = req.email.trim().toLowerCase();
        Optional<User> found = USERS.findByEmail(email);

        String hashToCheck = found.map(User::passwordHash).orElse(DUMMY_HASH);
        boolean passwordOk = PasswordHasher.verify(req.password, hashToCheck);

        if (found.isEmpty() || !passwordOk) {
            throw new UnauthorizedException("Invalid email or password.");
        }

        User user = found.get();
        if (user.suspended()) {
            throw new ForbiddenException("This account has been suspended.");
        }

        String accessToken = JWT.issueAccessToken(user.id(), user.role());
        String refreshToken = JWT.issueRefreshToken(user.id());

        return Response.ok(Map.of(
                "accessToken", accessToken,
                "refreshToken", refreshToken,
                "tokenType", "Bearer",
                "expiresIn", JWT.accessTokenTtlSeconds(),
                "userId", user.id(),
                "role", user.role().name(),
                "verified", user.verified()
        )).build();
    }

    // --- B-7: refresh (+ B-8 revocation guard) ---------------------------

    @POST
    @Path("/refresh")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response refresh(RefreshRequest req) {
        if (req == null || req.refreshToken == null || req.refreshToken.isBlank()) {
            throw new UnauthorizedException("Refresh token is required.");
        }

        DecodedJWT decoded;
        try {
            decoded = JWT.verify(req.refreshToken);
        } catch (JWTVerificationException e) {
            throw new UnauthorizedException("Refresh token invalid or expired.");
        }

        String typ = decoded.getClaim("typ").asString();
        if (!"refresh".equals(typ)) {
            throw new UnauthorizedException("Not a refresh token.");
        }

        // B-8: reject a refresh token that has been logged out.
        if (REVOKED.isRevoked(decoded.getId())) {
            throw new UnauthorizedException("Refresh token has been revoked.");
        }

        String userId = decoded.getSubject();
        if (userId == null) {
            throw new UnauthorizedException("Refresh token missing subject.");
        }

        Optional<User> found = USERS.findById(userId);
        if (found.isEmpty()) {
            throw new UnauthorizedException("User no longer exists.");
        }
        User user = found.get();
        if (user.suspended()) {
            throw new ForbiddenException("This account has been suspended.");
        }

        String accessToken = JWT.issueAccessToken(user.id(), user.role());

        return Response.ok(Map.of(
                "accessToken", accessToken,
                "tokenType", "Bearer",
                "expiresIn", JWT.accessTokenTtlSeconds()
        )).build();
    }

    // --- B-8: logout -----------------------------------------------------

    @POST
    @Path("/logout")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response logout(RefreshRequest req) {
        if (req == null || req.refreshToken == null || req.refreshToken.isBlank()) {
            throw new ValidationException("Refresh token is required.");
        }

        DecodedJWT decoded;
        try {
            decoded = JWT.verify(req.refreshToken);
        } catch (JWTVerificationException e) {
            // Already invalid or expired — it can't be used anyway, so logout
            // is a no-op success. Idempotent and forgiving.
            return Response.noContent().build();
        }

        String typ = decoded.getClaim("typ").asString();
        if (!"refresh".equals(typ)) {
            throw new UnauthorizedException("Not a refresh token.");
        }

        String jti = decoded.getId();
        if (jti != null && decoded.getExpiresAt() != null) {
            REVOKED.revoke(jti, decoded.getExpiresAt().toInstant());
        }
        return Response.noContent().build();
    }
}