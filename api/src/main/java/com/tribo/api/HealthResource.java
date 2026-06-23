package com.tribo.api;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.util.Map;

import com.tribo.api.iam.PublicEndpoint;

/**
 * Health check endpoint.
 *
 * GET /rest/health - { "status": "ok" }
 *
 * Confirms the API is deployed and Jersey + JSON serialization work.
 */
@Path("/health")
@PublicEndpoint
public class HealthResource {

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}