package com.tribo.api.activity;

import com.tribo.api.error.ApiException;
import com.tribo.api.error.ForbiddenException;
import com.tribo.api.error.NotFoundException;
import com.tribo.api.error.ValidationException;
import com.tribo.api.iam.AuthenticatedUser;
import com.tribo.api.iam.OwnershipGuard;

import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
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
    public Response join(@Context ContainerRequestContext ctx, @PathParam("id") String activityId,
                         @QueryParam("role") @DefaultValue("participant") String roleParam) {
        AuthenticatedUser caller = ActivityResource.authUser(ctx);
        Activity activity = ACTIVITIES.findById(activityId)
                .orElseThrow(() -> new NotFoundException("No activity with id " + activityId + "."));

        ParticipationRole role = parseRole(roleParam);

        if (activity.status() != ActivityStatus.PUBLISHED) {
            throw conflict("ACTIVITY_NOT_OPEN", "This activity is not open for registration.");
        }
        if (!activity.startsAt().isAfter(Instant.now())) {
            throw conflict("ACTIVITY_STARTED", "This activity has already started.");
        }
        if (PARTICIPANTS.exists(activityId, caller.userId())) {
            throw conflict("ALREADY_JOINED", "You have already joined this activity.");
        }

        // Capacity is per role. Not transactional — a rare race could admit one
        // over capacity; acceptable at this scale.
        if (role == ParticipationRole.STAFF) {
            if (activity.eventKind() != EventKind.VOLUNTEER || activity.staffCapacity() <= 0) {
                throw conflict("NOT_A_VOLUNTEER_EVENT", "This event has no staff roles.");
            }
            if (!VolunteerStats.isStaffEligible(caller.userId())) {
                throw new ForbiddenException("NOT_STAFF_ELIGIBLE",
                        "You need to join at least " + VolunteerStats.STAFF_THRESHOLD
                                + " volunteer events before you can be staff.");
            }
            if (PARTICIPANTS.countByActivityAndRole(activityId, ParticipationRole.STAFF) >= activity.staffCapacity()) {
                throw conflict("STAFF_FULL", "Staff spots are full.");
            }
        } else {
            if (PARTICIPANTS.countByActivityAndRole(activityId, ParticipationRole.PARTICIPANT) >= activity.capacity()) {
                throw conflict("ACTIVITY_FULL", "This activity is full.");
            }
        }

        Participation p = new Participation(activityId, caller.userId(), Instant.now(), role);
        PARTICIPANTS.save(p);
        return Response.status(Response.Status.CREATED)
                .entity(Map.of(
                        "activityId", p.activityId(),
                        "userId", p.userId(),
                        "joinedAt", p.joinedAt().toString(),
                        "role", p.role().name()))
                .build();
    }

    private static ParticipationRole parseRole(String raw) {
        if (raw == null || raw.isBlank()) return ParticipationRole.PARTICIPANT;
        try {
            return ParticipationRole.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ValidationException("Unknown role: " + raw + " (use participant or staff).");
        }
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
                        "joinedAt", p.joinedAt().toString(),
                        "role", p.role().name()))
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
