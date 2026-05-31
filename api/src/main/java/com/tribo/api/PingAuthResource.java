package com.tribo.api;

import com.tribo.api.iam.AllowedRoles;
import com.tribo.api.iam.AuthenticatedUser;
import com.tribo.api.iam.JwtAuthFilter;
import com.tribo.api.iam.Role;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;

/**
 * Probe endpoints exercising the auth filter and RBAC.
 *
 *   GET /rest/ping-auth/whoami         — any authenticated user
 *   GET /rest/ping-auth/admin-only     — SYSADMIN only
 *
 * Reads the authenticated user from the "tribo.user" request property set by
 * JwtAuthFilter. We deliberately do NOT cast the injected SecurityContext to
 * JwtSecurityContext: Jersey injects a SecurityContextInjectee proxy, not the
 * concrete object the filter set, so that cast throws ClassCastException.
 *
 * Delete in B-7 (or whenever the real authenticated endpoints exist).
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

    @GET
    @Path("/admin-only")
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({Role.SYSADMIN})
    public Response adminOnly(@Context ContainerRequestContext ctx) {
        AuthenticatedUser user =
                (AuthenticatedUser) ctx.getProperty(JwtAuthFilter.USER_PROPERTY);
        return Response.ok(Map.of(
                "message", "Hello, SysAdmin",
                "userId", user.userId()
        )).build();
    }
}