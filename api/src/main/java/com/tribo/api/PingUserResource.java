package com.tribo.api;

import com.tribo.api.iam.Role;
import com.tribo.api.iam.User;
import com.tribo.api.iam.UserRepository;
import com.tribo.api.iam.PasswordHasher;


import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

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

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response ping() {
        try {
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
                    false
            );

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
                                "existsByEmail", exists
                        ))
                        .build();
            }

            // B-2: exercise the password hasher
            String storedHash = byId.get().passwordHash();
            boolean verifyRight = PasswordHasher.verify("test-password-12345", storedHash);
            boolean verifyWrong = PasswordHasher.verify("WRONG-password", storedHash);

            return Response.ok(Map.of(
                    "ok", true,
                    "id", byId.get().id(),
                    "email", byEmail.get().email(),
                    "role", byEmail.get().role().name(),
                    "existsByEmail", exists,
                    "hashStartsWithBcryptPrefix", storedHash.startsWith("$2a$12$"),
                    "verifyRightPassword", verifyRight,
                    "verifyWrongPassword", verifyWrong
            )).build();

        } catch (Exception e) {
            return Response.serverError()
                    .entity(Map.of(
                            "error", "user repo round-trip failed",
                            "type", e.getClass().getSimpleName(),
                            "message", e.getMessage() == null ? "" : e.getMessage()
                    ))
                    .build();
        }
    }
}