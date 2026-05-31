package com.tribo.api;

import com.google.cloud.datastore.Datastore;
import com.google.cloud.datastore.DatastoreOptions;
import com.google.cloud.datastore.Entity;
import com.google.cloud.datastore.Key;
import com.google.cloud.datastore.KeyFactory;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.tribo.api.iam.PublicEndpoint;

/**
 * Database connectivity probe.
 *
 * GET /rest/ping-db
 *   - Writes ONE entity of kind "Ping" to Datastore.
 *   - Reads it back by key.
 *   - Returns the round-tripped values as JSON.
 *
 * Successful response proves Datastore is reachable and the App Engine
 * service account has read/write access.
 *
 * NOTE: This is a foundation probe. Remove before BETA evaluation.
 */
@Path("/ping-db")
@PublicEndpoint
public class PingDbResource {

    // DatastoreOptions.getDefaultInstance() uses Application Default Credentials:
    //   - On App Engine: the default service account, automatically.
    //   - Locally: picks up DATASTORE_EMULATOR_HOST if set.
    private static final Datastore DATASTORE =
            DatastoreOptions.getDefaultInstance().getService();

    private static final String KIND = "Ping";

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response ping() {
        try {
            String id = UUID.randomUUID().toString();
            String now = Instant.now().toString();

            KeyFactory keyFactory = DATASTORE.newKeyFactory().setKind(KIND);
            Key key = keyFactory.newKey(id);

            Entity entity = Entity.newBuilder(key)
                    .set("createdAt", now)
                    .set("message", "hello from tribo-api")
                    .build();

            DATASTORE.put(entity);

            Entity readBack = DATASTORE.get(key);
            if (readBack == null) {
                return Response.serverError()
                        .entity(Map.of("error", "write succeeded but read returned null"))
                        .build();
            }

            return Response.ok(Map.of(
                    "ok", true,
                    "id", id,
                    "createdAt", readBack.getString("createdAt"),
                    "message", readBack.getString("message")
            )).build();

        } catch (Exception e) {
            return Response.serverError()
                    .entity(Map.of(
                            "error", "datastore call failed",
                            "type", e.getClass().getSimpleName(),
                            "message", e.getMessage() == null ? "" : e.getMessage()
                    ))
                    .build();
        }
    }
}