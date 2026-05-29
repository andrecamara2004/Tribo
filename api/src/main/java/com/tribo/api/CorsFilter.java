package com.tribo.api;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.ext.Provider;

import java.io.IOException;

/**
 * Adds CORS headers to every response so browser clients (React on localhost
 * during development, deployed web app in production) can call the API.
 *
 * Jersey auto-discovers this class because of @Provider plus the package
 * scan configured in web.xml.
 *
 * For BETA we allow any origin (*). For PRE-FINAL / FINAL we should
 * restrict to the actual deployed web app's origin.
 */
@Provider
public class CorsFilter implements ContainerResponseFilter {

    @Override
    public void filter(ContainerRequestContext requestContext,
                       ContainerResponseContext responseContext) throws IOException {
        MultivaluedMap<String, Object> headers = responseContext.getHeaders();

        headers.add("Access-Control-Allow-Origin", "*");
        headers.add("Access-Control-Allow-Headers",
                "origin, content-type, accept, authorization");
        headers.add("Access-Control-Allow-Credentials", "true");
        headers.add("Access-Control-Allow-Methods",
                "GET, POST, PUT, DELETE, OPTIONS, HEAD");
        headers.add("Access-Control-Max-Age", "3600");
    }
}