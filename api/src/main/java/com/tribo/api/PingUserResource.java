package com.tribo.api;

import com.tribo.api.iam.Role;
import com.tribo.api.iam.User;
import com.tribo.api.iam.UserRepository;
import com.tribo.api.iam.PasswordHasher;
import com.tribo.api.iam.JwtIssuer;

import com.tribo.api.error.ValidationException;
import com.tribo.api.error.ConflictException;
import com.tribo.api.error.UnauthorizedException;

import com.auth0.jwt.interfaces.DecodedJWT;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.QueryParam;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * TEMPORARY foundations probe for ticket B-1.
 *
 * Exercises UserRepository end-to-end: save -> findById -> findByEmail ->
 * existsByEmail. Mirrors the existing /rest/ping-db probe pattern.
 *
 * GET /rest/ping-user
 *
 * Returns 200 with a small summary if every step works, 500 with the
 * exception details otherwise.
 *
 * DELETE THIS FILE when ticket B-6 (POST /rest/v1/auth/register) is merged.
 * It writes test entities to the User kind and would otherwise be a
 * permanent attack surface.
 */
@Path("/ping-user")
public class PingUserResource {

    private static final UserRepository REPO = new UserRepository();
    private static final JwtIssuer JWT = new JwtIssuer();

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response ping(@QueryParam("throw") String throwWhich) {
        try {
            // B-4: exercise the exception mapper
            if ("validation".equals(throwWhich)) {
                throw new ValidationException(
                        "Test validation error",
                        Map.of("email", "invalid format"));
            }
            if ("conflict".equals(throwWhich)) {
                throw new ConflictException("Email already registered.");
            }
            if ("unauthorized".equals(throwWhich)) {
                throw new UnauthorizedException("Token expired.");
            }
            if ("unchecked".equals(throwWhich)) {
                throw new RuntimeException("oops — should become INTERNAL_ERROR");
            }
            String id = UUID.randomUUID().toString();
            String email = "probe-" + id + "@tribo.test";

            User toSave = new User(
                    id,
                    email,
                    PasswordHasher.hash("test-password-12345"),
                    "Probe User",
                    "+351912345678",
                    25,
                    Role.END_USER,
                    User.ProfileVisibility.PUBLIC,
                    Instant.now(),
                    false);

            REPO.save(toSave);

            Optional<User> byId = REPO.findById(id);
            Optional<User> byEmail = REPO.findByEmail(email.toUpperCase()); // exercises case-insensitivity
            boolean exists = REPO.existsByEmail(email);

            if (byId.isEmpty() || byEmail.isEmpty() || !exists) {
                return Response.serverError()
                        .entity(Map.of(
                                "ok", false,
                                "byId", byId.isPresent(),
                                "byEmail", byEmail.isPresent(),
                                "existsByEmail", exists))
                        .build();
            }

            // B-2: password hasher round-trip
            String storedHash = byId.get().passwordHash();
            boolean verifyRight = PasswordHasher.verify("test-password-12345", storedHash);
            boolean verifyWrong = PasswordHasher.verify("WRONG-password", storedHash);

            // B-3: JWT issuer round-trip
            String accessToken = JWT.issueAccessToken(byId.get().id(), byId.get().role());
            String refreshToken = JWT.issueRefreshToken(byId.get().id());

            DecodedJWT decodedAccess = JWT.verify(accessToken);
            DecodedJWT decodedRefresh = JWT.verify(refreshToken);

            boolean accessHasRole = "END_USER".equals(decodedAccess.getClaim("role").asString());
            boolean refreshIsRefreshTyp = "refresh".equals(decodedRefresh.getClaim("typ").asString());
            boolean accessSubjectMatches = byId.get().id().equals(decodedAccess.getSubject());

            return Response.ok(Map.of(
                    "ok", true,
                    "id", byId.get().id(),
                    "email", byEmail.get().email(),
                    "existsByEmail", exists,
                    "hashStartsWithBcryptPrefix", storedHash.startsWith("$2a$12$"),
                    "verifyRightPassword", verifyRight,
                    "verifyWrongPassword", verifyWrong,
                    "accessHasRoleClaim", accessHasRole,
                    "refreshTypIsRefresh", refreshIsRefreshTyp,
                    "accessSubjectMatchesUserId", accessSubjectMatches)).build();

        } catch (com.tribo.api.error.ApiException e) {
            // Let the ApiExceptionMapper format this — re-throw, don't swallow.
            throw e;
        } catch (Exception e) {
            return Response.serverError()
                    .entity(Map.of(
                            "error", "user repo round-trip failed",
                            "type", e.getClass().getSimpleName(),
                            "message", e.getMessage() == null ? "" : e.getMessage()))
                    .build();
        }
    }
}