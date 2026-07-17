package com.tribo.api;

import com.tribo.api.error.ValidationException;
import com.tribo.api.iam.AllowedRoles;
import com.tribo.api.iam.PasswordPolicy;
import com.tribo.api.iam.PasswordPolicyRepository;
import com.tribo.api.iam.Role;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;

/**
 * Runtime configuration endpoints (SYSADMIN). Currently just the password
 * policy, so the rules live in Datastore and can be changed without a redeploy.
 *
 * Not a {@code @PublicEndpoint}: JwtAuthFilter enforces authentication and
 * {@code @AllowedRoles} restricts writes to SYSADMIN. The public read of the
 * policy (for the register form) lives at GET /auth/password-policy.
 */
@Path("/config")
public class ConfigResource {

    private static final PasswordPolicyRepository POLICY = new PasswordPolicyRepository();

    @GET
    @Path("/password-policy")
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({ Role.SYSADMIN, Role.BACKOFFICE })
    public Response getPasswordPolicy() {
        return Response.ok(view(POLICY.get())).build();
    }

    @PUT
    @Path("/password-policy")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({ Role.SYSADMIN })
    public Response updatePasswordPolicy(PolicyRequest req) {
        if (req == null) {
            throw new ValidationException("Request body is required.");
        }
        int minLength = req.minLength == null ? 8 : req.minLength;
        if (minLength < 4 || minLength > 128) {
            throw new ValidationException("minLength must be between 4 and 128.");
        }
        PasswordPolicy p = new PasswordPolicy(
                minLength,
                Boolean.TRUE.equals(req.requireUppercase),
                Boolean.TRUE.equals(req.requireLowercase),
                Boolean.TRUE.equals(req.requireDigit),
                Boolean.TRUE.equals(req.requireSpecial));
        POLICY.save(p);
        return Response.ok(view(p)).build();
    }

    private static Map<String, Object> view(PasswordPolicy p) {
        return Map.of(
                "minLength", p.minLength(),
                "requireUppercase", p.requireUppercase(),
                "requireLowercase", p.requireLowercase(),
                "requireDigit", p.requireDigit(),
                "requireSpecial", p.requireSpecial(),
                "rules", p.describe());
    }

    /** Body for PUT /config/password-policy. */
    public static class PolicyRequest {
        public Integer minLength;
        public Boolean requireUppercase;
        public Boolean requireLowercase;
        public Boolean requireDigit;
        public Boolean requireSpecial;
    }
}
