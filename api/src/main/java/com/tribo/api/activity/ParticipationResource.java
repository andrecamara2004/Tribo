package com.tribo.api.activity;

import com.tribo.api.error.ApiException;
import com.tribo.api.error.NotFoundException;
import com.tribo.api.iam.AuthenticatedUser;
import com.tribo.api.iam.OwnershipGuard;

import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Participation sub-resource (B2-8..B2-10).
 *
 *   POST   /rest/activities/{id}/participants      join     (any authenticated user)
 *   DELETE /rest/activities/{id}/participants/me   withdraw (the caller)
 *   GET    /rest/activities/{id}/participants       roster  (owner or privileged)
 *
 * Authenticated for the whole class via JwtAuthFilter. Reuses
 * ActivityResource.authUser() to read the caller from the request.
 */
@Path("/activities/{id}/participants")
public class ParticipationResource {

    private static final ActivityRepository ACTIVITIES = new ActivityRepository();
    private static final ParticipationRepository PARTICIPANTS = new ParticipationRepository();

    // --- B2-8: join ----------------------------------------------------------

    @POST
    @Produces(MediaType.APPLICATION_JSON)
    public Response join(@Context ContainerRequestContext ctx, @PathParam("id") String activityId) {
        AuthenticatedUser caller = ActivityResource.authUser(ctx);
        Activity activity = ACTIVITIES.findById(activityId)
                .orElseThrow(() -> new NotFoundException("No activity with id " + activityId + "."));

        if (activity.status() != ActivityStatus.PUBLISHED) {
            throw conflict("ACTIVITY_NOT_OPEN", "This activity is not open for registration.");
        }
        if (!activity.startsAt().isAfter(Instant.now())) {
            throw conflict("ACTIVITY_STARTED", "This activity has already started.");
        }
        if (PARTICIPANTS.exists(activityId, caller.userId())) {
            throw conflict("ALREADY_JOINED", "You have already joined this activity.");
        }
        // Capacity check. Not transactional — a rare race could admit one over
        // capacity; acceptable for Sprint 1-scale traffic. Tighten with a
        // Datastore transaction if it becomes a real concern.
        if (PARTICIPANTS.countByActivity(activityId) >= activity.capacity()) {
            throw conflict("ACTIVITY_FULL", "This activity is full.");
        }

        Participation p = new Participation(activityId, caller.userId(), Instant.now());
        PARTICIPANTS.save(p);
        return Response.status(Response.Status.CREATED)
                .entity(Map.of(
                        "activityId", p.activityId(),
                        "userId", p.userId(),
                        "joinedAt", p.joinedAt().toString()))
                .build();
    }

    // --- B2-9: withdraw ------------------------------------------------------

    @DELETE
    @Path("/me")
    public Response withdraw(@Context ContainerRequestContext ctx, @PathParam("id") String activityId) {
        AuthenticatedUser caller = ActivityResource.authUser(ctx);
        // Idempotent: deleting a non-existent participation is a no-op success.
        PARTICIPANTS.delete(activityId, caller.userId());
        return Response.noContent().build();
    }

    // --- B2-10: roster (owner or privileged) --------------------------------

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response roster(@Context ContainerRequestContext ctx, @PathParam("id") String activityId) {
        AuthenticatedUser caller = ActivityResource.authUser(ctx);
        Activity activity = ACTIVITIES.findById(activityId)
                .orElseThrow(() -> new NotFoundException("No activity with id " + activityId + "."));

        OwnershipGuard.requireOwnerOrPrivileged(caller, activity.ownerId());

        List<Map<String, Object>> participants = PARTICIPANTS.findByActivity(activityId).stream()
                .map(p -> Map.<String, Object>of(
                        "userId", p.userId(),
                        "joinedAt", p.joinedAt().toString()))
                .toList();

        return Response.ok(Map.of(
                "activityId", activityId,
                "count", participants.size(),
                "participants", participants
        )).build();
    }

    private static ApiException conflict(String code, String message) {
        return new ApiException(code, message, Response.Status.CONFLICT);
    }
}
