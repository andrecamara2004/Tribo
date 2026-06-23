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
 *
 *   GET /rest/ping-auth/whoami - any authenticated user
 */
@Path("/ping-auth")
public class PingAuthResource {

//TODO currently throwing an error on web console. Might need to check but it does not affect the product overall.
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