package com.tribo.api;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.ext.Provider;

import java.io.IOException;

/**
 * Adds CORS headers to every outgoing response.
 *
 * Runs on every response, including the aborted OPTIONS responses produced by
 * CorsPreflightFilter
 *
 * @Provider makes Jersey auto-discover this class via the package scan
 * configured in web.xml.
 */
@Provider
public class CorsFilter implements ContainerResponseFilter {

        @Override
        public void filter(ContainerRequestContext requestContext,
                        ContainerResponseContext responseContext) throws IOException {
                MultivaluedMap<String, Object> headers = responseContext.getHeaders();

                String origin = requestContext.getHeaderString("Origin");
                String allowed = "https://web-dot-tribo-497810.ew.r.appspot.com";
                if (allowed.equals(origin) || (origin != null && origin.startsWith("http://localhost"))) {
                        headers.add("Access-Control-Allow-Origin", origin);
                }
                headers.add("Access-Control-Allow-Headers",
                                "origin, content-type, accept, authorization");
                headers.add("Access-Control-Allow-Credentials", "true");
                headers.add("Access-Control-Allow-Methods",
                                "GET, POST, PUT, DELETE, OPTIONS, HEAD");
                headers.add("Access-Control-Max-Age", "3600");
        }
}