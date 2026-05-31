package com.tribo.api;

import com.tribo.api.iam.AllowedRoles;
import com.tribo.api.iam.AuthenticatedUser;
import com.tribo.api.iam.JwtSecurityContext;
import com.tribo.api.iam.Role;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;

import java.util.Map;

/**
 * Probe endpoints exercising the auth filter and RBAC.
 *
 *   GET /rest/ping-auth/whoami         — any authenticated user
 *   GET /rest/ping-auth/admin-only     — SYSADMIN only
 *
 * Delete in B-7 (or whenever the real authenticated endpoints exist).
 */
@Path("/ping-auth")
public class PingAuthResource {

    @GET
    @Path("/whoami")
    @Produces(MediaType.APPLICATION_JSON)
    public Response whoami(@Context SecurityContext sec) {
        AuthenticatedUser user = ((JwtSecurityContext) sec).user();
        return Response.ok(Map.of(
                "userId", user.userId(),
                "role", user.role().name()
        )).build();
    }

    @GET
    @Path("/admin-only")
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({Role.SYSADMIN})
    public Response adminOnly(@Context SecurityContext sec) {
        AuthenticatedUser user = ((JwtSecurityContext) sec).user();
        return Response.ok(Map.of(
                "message", "Hello, SysAdmin",
                "userId", user.userId()
        )).build();
    }
}