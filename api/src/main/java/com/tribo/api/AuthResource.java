package com.tribo.api;

import com.tribo.api.error.ConflictException;
import com.tribo.api.error.ForbiddenException;
import com.tribo.api.error.NotFoundException;
import com.tribo.api.error.UnauthorizedException;
import com.tribo.api.error.ValidationException;
import com.tribo.api.iam.JwtIssuer;
import com.tribo.api.iam.LoginRateLimiter;
import com.tribo.api.iam.LoginRequest;
import com.tribo.api.iam.PasswordHasher;
import com.tribo.api.iam.PublicEndpoint;
import com.tribo.api.iam.RefreshRequest;
import com.tribo.api.iam.RegisterRequest;
import com.tribo.api.iam.RevokedTokenRepository;
import com.tribo.api.iam.Role;
import com.tribo.api.iam.SendGridVerificationEmailService;
import com.tribo.api.iam.User;
import com.tribo.api.iam.UserRepository;
import com.tribo.api.iam.VerificationEmailService;

import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.tribo.api.iam.ResendVerificationRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.net.URI;
import java.time.Instant;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

import com.tribo.api.iam.VerificationTokenRepository;
import com.tribo.api.error.TooManyRequestsException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Context;

/**
 * Authentication endpoints.
 *
 * POST /rest/auth/register - create a new END_USER account.
 * POST /rest/auth/login - Login - exchange credentials for tokens.
 * POST /rest/auth/refresh - exchange a refresh token for a new access token.
 * POST /rest/auth/logout - revoke a refresh token.
 */
@Path("/auth")
@PublicEndpoint
public class AuthResource {

    private static final UserRepository USERS = new UserRepository();
    private static final RevokedTokenRepository REVOKED = new RevokedTokenRepository();
    private static final JwtIssuer JWT = new JwtIssuer();
    private static final VerificationTokenRepository VERIFICATION_TOKENS = new VerificationTokenRepository();

    // private static final VerificationEmailService EMAIL_VERIFICATION_SERVICE =
    // new SendGridVerificationEmailService();
    private static VerificationEmailService emailVerificationService() {
        return new SendGridVerificationEmailService();
    }

    @Context
    private HttpServletRequest httpRequest;

    // Dummy hash so the "no such user" login path still runs a bcrypt verify,
    // keeping response timing independent of whether the email exists.
    // TODO need to know why this is still here
    private static final String DUMMY_HASH = PasswordHasher.hash("dummy-password-placeholder");

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final int MIN_AGE = 13;
    private static final int MAX_AGE = 120;

    @POST
    @Path("/register")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response register(RegisterRequest req) {
        if (req == null) {
            throw new ValidationException("Request body is required.");
        }

        String registerIp = clientIp(httpRequest);
        if (LoginRateLimiter.isRateLimited(registerIp)) {
            throw new TooManyRequestsException("Too many requests. Please wait a minute and try again.");
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

        Role role = resolveRequestedRole(req.role);
        boolean approved;
        // bootstrap sysadmin
        String bootstrapEmail = System.getenv("BOOTSTRAP_ADMIN_EMAIL");
        if (bootstrapEmail != null && email.equalsIgnoreCase(bootstrapEmail.trim())) {
            // One-time seed: the configured email is created as a verified
            // SYSADMIN so there is a privileged account to verify the rest.
            role = Role.SYSADMIN;
            approved = true;
        } else {
            // END_USER is usable immediately; privileged roles await backoffice
            // verification before they can act (e.g. create activities).
            approved = (role == Role.END_USER);
        }

        boolean emailVerified = false;

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
                approved,
                emailVerified,
                null, // new users start without a clan
                0.0 // no weekly goal yet
        );
        USERS.save(user);

        // gera token de verificação com validade de 24h
        String token = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plus(Duration.ofHours(24));
        VerificationTokenRepository.VerificationToken vt = new VerificationTokenRepository.VerificationToken(
                token, userId, expiresAt, false);
        VERIFICATION_TOKENS.save(vt);

        // EMAIL_VERIFICATION_SERVICE.sendVerificationEmail(email, token);
        emailVerificationService().sendVerificationEmail(email, token);

        return Response.created(URI.create("/rest/users/" + userId))
                .entity(Map.of(
                        "userId", userId,
                        "email", email,
                        "role", user.role().name(),
                        "verified", user.verified()))
                .build();
    }

    /**
     * Roles a user may pick at registration. Privileged roles are excluded
     * (BACKOFFICE and SYSADMIN).
     */
    private static final java.util.Set<Role> SELF_REGISTERABLE = java.util.EnumSet.of(Role.END_USER,
            Role.ACTIVITY_MANAGER, Role.PARTNER);

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

    @POST
    @Path("/login")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response login(LoginRequest req) {
        if (req == null || req.email == null || req.password == null) {
            throw new UnauthorizedException("Invalid email or password.");
        }

        String loginIp = clientIp(httpRequest);
        if (LoginRateLimiter.isRateLimited(loginIp)) {
            throw new TooManyRequestsException("Too many login attempts. Please wait a minute and try again.");
        }

        String email = req.email.trim().toLowerCase();
        Optional<User> found = USERS.findByEmail(email);

        String hashToCheck = found.map(User::passwordHash).orElse(DUMMY_HASH);
        boolean passwordOk = PasswordHasher.verify(req.password, hashToCheck);

        if (found.isEmpty() || !passwordOk) {
            throw new UnauthorizedException("Invalid email or password.");
        }

        User user = found.get();
        if (!user.emailVerified()) {
            throw new ForbiddenException("Please verify your email before logging in.");
        }
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
                "verified", user.verified(),
                "emailVerified", user.emailVerified()))
                .build();
    }

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

        // reject a refresh token that has been logged out.
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
                "expiresIn", JWT.accessTokenTtlSeconds())).build();
    }

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
            // Already invalid or expired - it cannot be used anyway, so logout
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

    @GET
    @Path("/verify-email")
    @Produces(MediaType.APPLICATION_JSON)
    public Response verifyEmail(@QueryParam("token") String token) {
        if (token == null || token.isBlank()) {
            throw new ValidationException("Verification token is required.");
        }

        Optional<VerificationTokenRepository.VerificationToken> found = VERIFICATION_TOKENS.findByToken(token);
        if (found.isEmpty()) {
            throw new ValidationException("Verification token is invalid.");
        }

        VerificationTokenRepository.VerificationToken vt = found.get();
        if (vt.used()) {
            throw new ValidationException("Verification token has already been used.");
        }
        if (vt.expiresAt().isBefore(Instant.now())) {
            throw new ValidationException("Verification token has expired.");
        }

        // marca emailVerified=true
        Optional<User> updated = USERS.setEmailVerified(vt.userId());
        if (updated.isEmpty()) {
            throw new NotFoundException("User no longer exists.");
        }

        VERIFICATION_TOKENS.markUsed(token);

        User user = updated.get();
        return Response.ok(Map.of(
                "userId", user.id(),
                "email", user.email(),
                "emailVerified", user.emailVerified()))
                .build();
    }

    /**
     * Reenvia email de verificação de conta para utilizadores ainda não
     * verificados.
     */
    @POST
    @Path("/resend-verification")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response resendVerification(ResendVerificationRequest req) {
        if (req == null || req.email == null || req.email.isBlank()) {
            throw new ValidationException("Email is required.");
        }

        String resendIp = clientIp(httpRequest);
        if (LoginRateLimiter.isRateLimited(resendIp)) {
            throw new TooManyRequestsException("Too many requests. Please wait a minute and try again.");
        }

        String email = req.email.trim().toLowerCase();
        Optional<User> found = USERS.findByEmail(email);

        // Boas práticas: não revelar se o email existe ou não (evita
        // enumeração).[web:17]
        if (found.isEmpty()) {
            return Response.ok(Map.of(
                    "message",
                    "If your email is not verified, you will receive a new verification link shortly.")).build();
        }

        User user = found.get();
        if (user.emailVerified()) {
            return Response.ok(Map.of(
                    "message",
                    "This email address is already verified.")).build();
        }

        // Gera novo token de verificação (24h)
        String token = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plus(Duration.ofHours(24));
        VerificationTokenRepository.VerificationToken vt = new VerificationTokenRepository.VerificationToken(token,
                user.id(), expiresAt, false);
        VERIFICATION_TOKENS.save(vt);

        // EMAIL_VERIFICATION_SERVICE.sendVerificationEmail(user.email(), token);
        emailVerificationService().sendVerificationEmail(user.email(), token);

        return Response.ok(Map.of(
                "message",
                "Verification email resent. Please check your inbox.")).build();
    }

    /**
     * Resolves the real client IP. App Engine sets X-Forwarded-For with the
     * original client IP as the first entry; fall back to RemoteAddr for
     * local dev (where the header is absent).
     */
    private static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }
}