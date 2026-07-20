package com.tribo.api;

import com.tribo.api.error.ConflictException;
import com.tribo.api.error.ForbiddenException;
import com.tribo.api.error.UnauthorizedException;
import com.tribo.api.error.ValidationException;
import com.tribo.api.iam.EmailSender;
import com.tribo.api.iam.JwtIssuer;
import com.tribo.api.iam.LoginRateLimiter;
import com.tribo.api.iam.LoginRequest;
import com.tribo.api.iam.PasswordHasher;
import com.tribo.api.iam.PasswordPolicy;
import com.tribo.api.iam.PasswordPolicyRepository;
import com.tribo.api.iam.PublicEndpoint;
import com.tribo.api.iam.RefreshRequest;
import com.tribo.api.iam.RegisterRequest;
import com.tribo.api.iam.RevokedTokenRepository;
import com.tribo.api.iam.Role;
import com.tribo.api.iam.User;
import com.tribo.api.iam.UserRepository;
import com.tribo.api.iam.VerificationTokenRepository;
import com.tribo.api.iam.PasswordResetTokenRepository;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
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
    private static final PasswordPolicyRepository PASSWORD_POLICY = new PasswordPolicyRepository();
    private static final PasswordResetTokenRepository PASSWORD_RESET_TOKENS = new PasswordResetTokenRepository();
    private static final VerificationTokenRepository VERIFICATION = new VerificationTokenRepository();
    private static final JwtIssuer JWT = new JwtIssuer();

    // Email-verification tokens are valid for 24 hours.
    private static final long VERIFICATION_TTL_HOURS = 24;

    @Context
    private HttpServletRequest httpRequest;

    // Dummy hash so the "no such user" login path still runs a bcrypt verify,
    // keeping response timing independent of whether the email exists.
    // TODO need to know why this is still here
    private static final String DUMMY_HASH = PasswordHasher.hash("dummy-password-placeholder");

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
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
        // Password rules come from Datastore (SYSADMIN-configurable), not hardcoded.
        String pwdError = PASSWORD_POLICY.get().validate(req.password);
        if (pwdError != null) {
            throw new ValidationException(pwdError);
        }
        if (fullName == null || fullName.isEmpty()) {
            throw new ValidationException("Full name is required.");
        }
        if (phone == null || phone.isEmpty()) {
            throw new ValidationException("Phone number is required.");
        }
        String birthDate = req.birthDate == null ? null : req.birthDate.trim();
        LocalDate dob;
        try {
            dob = LocalDate.parse(birthDate); // expects ISO YYYY-MM-DD
        } catch (Exception e) {
            throw new ValidationException("A valid birth date (YYYY-MM-DD) is required.");
        }
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if (dob.isAfter(today)) {
            throw new ValidationException("Birth date can't be in the future.");
        }
        int age = (int) ChronoUnit.YEARS.between(dob, today);
        if (age < MIN_AGE || age > MAX_AGE) {
            throw new ValidationException(
                    "You must be between " + MIN_AGE + " and " + MAX_AGE + " years old.");
        }

        if (USERS.existsByEmail(email)) {
            throw new ConflictException("An account with this email already exists.");
        }

        Role role = resolveRequestedRole(req.role);
        boolean verified;
        boolean emailVerified;
        // Bootstrap privileged accounts by email (env-configured). These are
        // seeded ready-to-use: verified AND email-verified (they skip the email
        // gate, since their domain may not receive mail).
        String bootstrapEmail = System.getenv("BOOTSTRAP_ADMIN_EMAIL");
        if (bootstrapEmail != null && email.equalsIgnoreCase(bootstrapEmail.trim())) {
            role = Role.SYSADMIN;
            verified = true;
            emailVerified = true;
        } else if (bootstrapBackofficeEmails().contains(email)) {
            role = Role.BACKOFFICE;
            verified = true;
            emailVerified = true;
        } else {
            // END_USER is usable immediately (once email-verified); privileged
            // roles also await backoffice verification before they can act.
            verified = (role == Role.END_USER);
            emailVerified = false; // must confirm their email before logging in
        }

        String userId = UUID.randomUUID().toString();
        User user = new User(
                userId,
                email,
                PasswordHasher.hash(req.password),
                fullName,
                phone,
                birthDate,
                role,
                User.ProfileVisibility.PUBLIC,
                Instant.now(),
                false,
                verified,
                null, // new users start without a clan
                0.0, // no weekly goal yet
                null, // no profile picture yet
                emailVerified,
                User.ThemePreference.LIGHT);
        USERS.save(user);

        // Send the confirmation email (best-effort) unless already verified.
        if (!emailVerified) {
            issueVerificationEmail(userId, email);
        }

        return Response.created(URI.create("/rest/users/" + userId))
                .entity(Map.of(
                        "userId", userId,
                        "email", email,
                        "role", user.role().name(),
                        "verified", user.verified(),
                        "emailVerified", user.emailVerified(),
                        "message", emailVerified
                                ? "Account created."
                                : "Account created. Check your email to confirm it before logging in."))
                .build();
    }

    /** Issues a fresh verification token and emails the confirmation link. */
    private void issueVerificationEmail(String userId, String email) {
        VERIFICATION.deleteByUser(userId); // invalidate any previous token
        String token = VERIFICATION.create(
                userId, Instant.now().plus(VERIFICATION_TTL_HOURS, ChronoUnit.HOURS));
        EmailSender.sendVerificationEmail(email, token);
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

    /**
     * Lowercased emails seeded as BACKOFFICE, from the comma-separated
     * BOOTSTRAP_BACKOFFICE_EMAILS env var (empty when unset).
     */
    private static java.util.Set<String> bootstrapBackofficeEmails() {
        String raw = System.getenv("BOOTSTRAP_BACKOFFICE_EMAILS");
        if (raw == null || raw.isBlank()) {
            return java.util.Set.of();
        }
        java.util.Set<String> out = new java.util.HashSet<>();
        for (String s : raw.split(",")) {
            String e = s.trim().toLowerCase();
            if (!e.isEmpty()) {
                out.add(e);
            }
        }
        return out;
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
        if (user.suspended()) {
            throw new ForbiddenException("This account has been suspended.");
        }
        if (!user.emailVerified()) {
            throw new ForbiddenException("EMAIL_NOT_VERIFIED",
                    "Please confirm your email before logging in. Check your inbox for the link.");
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
                "verified", user.verified())).build();
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

    @POST
    @Path("/verify-email")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response verifyEmail(VerifyEmailRequest req) {
        if (req == null || req.token == null || req.token.isBlank()) {
            throw new ValidationException("Verification token is required.");
        }
        String userId = VERIFICATION.resolveUserId(req.token)
                .orElseThrow(() -> new ValidationException(
                        "This verification link is invalid or has expired."));
        USERS.setEmailVerified(userId);
        VERIFICATION.delete(req.token);
        return Response.ok(Map.of(
                "emailVerified", true,
                "message", "Email confirmed. You can now log in.")).build();
    }

    @POST
    @Path("/resend-verification")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response resendVerification(ResendRequest req) {
        String ip = clientIp(httpRequest);
        if (LoginRateLimiter.isRateLimited(ip)) {
            throw new TooManyRequestsException("Too many requests. Please wait a minute and try again.");
        }
        if (req != null && req.email != null && !req.email.isBlank()) {
            String email = req.email.trim().toLowerCase();
            USERS.findByEmail(email).ifPresent(u -> {
                if (!u.emailVerified()) {
                    issueVerificationEmail(u.id(), u.email());
                }
            });
        }
        // Generic response — never reveal whether an account exists.
        return Response.ok(Map.of(
                "message", "If that account exists and is unverified, a new confirmation link has been sent."))
                .build();
    }

    @GET
    @Path("/password-policy")
    @Produces(MediaType.APPLICATION_JSON)
    public Response passwordPolicy() {
        PasswordPolicy p = PASSWORD_POLICY.get();
        return Response.ok(Map.of(
                "minLength", p.minLength(),
                "requireUppercase", p.requireUppercase(),
                "requireLowercase", p.requireLowercase(),
                "requireDigit", p.requireDigit(),
                "requireSpecial", p.requireSpecial(),
                "rules", p.describe())).build();
    }

    /** Body for POST /auth/verify-email. */
    public static class VerifyEmailRequest {
        public String token;
    }

    /** Body for POST /auth/resend-verification. */
    public static class ResendRequest {
        public String email;
    }

    public static class ResetPasswordRequestDto {
        public String email;
    }

    public static class ResetPasswordSubmitDto {
        public String token;
        public String newPassword;
    }

    @POST
    @Path("/reset-password-request")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response resetPasswordRequest(ResetPasswordRequestDto req) {
        String ip = clientIp(httpRequest);
        if (LoginRateLimiter.isRateLimited(ip)) {
            throw new TooManyRequestsException("Too many requests. Please wait a minute and try again.");
        }
        if (req != null && req.email != null && !req.email.isBlank()) {
            String email = req.email.trim().toLowerCase();
            USERS.findByEmail(email).ifPresent(u -> {
                PASSWORD_RESET_TOKENS.deleteByUser(u.id());
                String token = PASSWORD_RESET_TOKENS.create(u.id(), Instant.now().plus(24, ChronoUnit.HOURS));
                EmailSender.sendPasswordResetEmail(u.email(), token);
            });
        }
        // Generic response — never reveal whether an account exists.
        return Response.ok(Map.of(
                "message", "A password reset link has been sent."))
                .build();
    }

    @POST
    @Path("/reset-password")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response resetPassword(ResetPasswordSubmitDto req) {
        if (req == null || req.token == null || req.token.isBlank() || req.newPassword == null
                || req.newPassword.isBlank()) {
            throw new ValidationException("Token and new password are required.");
        }

        PASSWORD_POLICY.get().validate(req.newPassword);

        String userId = PASSWORD_RESET_TOKENS.resolveUserId(req.token)
                .orElseThrow(() -> new UnauthorizedException("Invalid or expired password reset token."));

        PASSWORD_RESET_TOKENS.delete(req.token);

        String newHash = PasswordHasher.hash(req.newPassword);
        USERS.updatePasswordHash(userId, newHash)
                .orElseThrow(() -> new UnauthorizedException("User no longer exists."));

        return Response.ok(Map.of("message", "Password successfully updated.")).build();
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