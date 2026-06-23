package com.tribo.api;

import jakarta.annotation.Priority;
import jakarta.ws.rs.HttpMethod;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;

import java.io.IOException;

/**
 * Handles CORS preflight (OPTIONS) requests by short-circuiting with a 200
 * before routing tries (and fails) to match OPTIONS to a resource method.
 *
 * Needed this for testing on localhost
 */
@Provider
@PreMatching
@Priority(Priorities.HEADER_DECORATOR)
public class CorsPreflightFilter implements ContainerRequestFilter {

    @Override
    public void filter(ContainerRequestContext ctx) throws IOException {
        if (HttpMethod.OPTIONS.equalsIgnoreCase(ctx.getMethod())) {
            ctx.abortWith(Response.ok().build());
        }
    }
}