package com.tribo.api;

import com.tribo.api.error.NotFoundException;
import com.tribo.api.iam.AllowedRoles;
import com.tribo.api.iam.Role;
import com.tribo.api.iam.User;
import com.tribo.api.iam.UserRepository;

import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;

/**
 * User administration endpoints.
 *
 *   POST /rest/users/{id}/verify — backoffice verifies a self-registered
 *                                  ACTIVITY_MANAGER / PARTNER so they may act.
 *
 * D-1: privileged roles self-register UNVERIFIED; this is how they get
 * cleared. Authentication is enforced by JwtAuthFilter; the @AllowedRoles
 * filter restricts the action to BACKOFFICE / SYSADMIN.
 *
 * The richer GET /rest/users/me profile read is still deferred (see
 * api-contract.md §3) — clients use /ping-auth/whoami for identity.
 */
@Path("/users")
public class UsersResource {

    private static final UserRepository USERS = new UserRepository();

    @POST
    @Path("/{id}/verify")
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({Role.BACKOFFICE, Role.SYSADMIN})
    public Response verify(@PathParam("id") String id) {
        User updated = USERS.markVerified(id)
                .orElseThrow(() -> new NotFoundException("No user with id " + id + "."));
        return Response.ok(Map.of(
                "userId", updated.id(),
                "role", updated.role().name(),
                "verified", updated.verified()
        )).build();
    }
}
