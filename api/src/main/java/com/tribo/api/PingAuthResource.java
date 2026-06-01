package com.tribo.api;

import com.tribo.api.iam.AuthenticatedUser;
import com.tribo.api.iam.JwtAuthFilter;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;

/**
 * Authenticated identity probe.
 *
 *   GET /rest/ping-auth/whoami — any authenticated user
 *
 * This is the session-bootstrap endpoint the web and mobile clients call after
 * login and on launch (see api-contract.md §3). It is the lightweight,
 * DB-free token check; the richer profile read lives at the future
 * GET /rest/users/me. Keep this until /users/me exists, then migrate clients.
 *
 * Reads the authenticated user from the "tribo.user" request property set by
 * JwtAuthFilter. We deliberately do NOT cast the injected SecurityContext to
 * JwtSecurityContext: Jersey injects a SecurityContextInjectee proxy, not the
 * concrete object the filter set, so that cast throws ClassCastException.
 */
@Path("/ping-auth")
public class PingAuthResource {

    @GET
    @Path("/whoami")
    @Produces(MediaType.APPLICATION_JSON)
    public Response whoami(@Context ContainerRequestContext ctx) {
        AuthenticatedUser user =
                (AuthenticatedUser) ctx.getProperty(JwtAuthFilter.USER_PROPERTY);
        return Response.ok(Map.of(
                "userId", user.userId(),
                "role", user.role().name()
        )).build();
    }
}