package com.tribo.api.activity;

import com.tribo.api.error.ForbiddenException;
import com.tribo.api.error.NotFoundException;
import com.tribo.api.error.UnauthorizedException;
import com.tribo.api.error.ValidationException;
import com.tribo.api.iam.AllowedRoles;
import com.tribo.api.iam.AuthenticatedUser;
import com.tribo.api.iam.JwtAuthFilter;
import com.tribo.api.iam.OwnershipGuard;
import com.tribo.api.iam.Role;
import com.tribo.api.iam.User;
import com.tribo.api.iam.UserRepository;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.net.URI;
import java.time.DateTimeException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Activity management endpoints (Sprint 2).
 *
 *   POST   /rest/activities           create        (verified ACTIVITY_MANAGER/PARTNER/SYSADMIN)
 *   GET    /rest/activities           list/discover (any authenticated user)
 *   GET    /rest/activities/{id}      detail        (any authenticated user)
 *   PUT    /rest/activities/{id}      edit          (owner or privileged)
 *   POST   /rest/activities/{id}/cancel  cancel     (owner or privileged)
 *   POST   /rest/activities/{id}/approve approve    (BACKOFFICE/SYSADMIN)
 *   POST   /rest/activities/{id}/reject  reject     (BACKOFFICE/SYSADMIN)
 *
 * APPROVAL: manager/partner submissions are created PENDING_APPROVAL and stay
 * out of the public catalog until a backoffice approves them; a SYSADMIN-created
 * activity is PUBLISHED immediately.
 *
 * Authentication is enforced for the whole class by JwtAuthFilter (no
 * @PublicEndpoint). Role gating uses @AllowedRoles; ownership uses
 * OwnershipGuard. Participation sub-resources live in ParticipationResource.
 */
@Path("/activities")
public class ActivityResource {

    private static final ActivityRepository ACTIVITIES = new ActivityRepository();
    private static final ParticipationRepository PARTICIPANTS = new ParticipationRepository();
    private static final UserRepository USERS = new UserRepository();

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 100;

    // --- B2-3: create --------------------------------------------------------

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({Role.ACTIVITY_MANAGER, Role.PARTNER, Role.SYSADMIN})
    public Response create(@Context ContainerRequestContext ctx, ActivityRequest req) {
        AuthenticatedUser caller = authUser(ctx);
        requireVerified(caller);

        Validated v = validate(req);

        Instant now = Instant.now();
        String id = UUID.randomUUID().toString();
        // Manager/partner submissions await backoffice approval before going
        // public; a SYSADMIN is trusted and publishes directly.
        ActivityStatus initialStatus = caller.role() == Role.SYSADMIN
                ? ActivityStatus.PUBLISHED
                : ActivityStatus.PENDING_APPROVAL;
        Activity activity = new Activity(
                id,
                caller.userId(),          // owner is the caller, from the JWT
                v.title, v.description, v.category, v.location,
                v.startsAt, v.endsAt, v.capacity,
                initialStatus,
                now, now,
                v.eventKind, v.host, v.distanceKm, v.verifiedBy,
                v.staffCapacity, v.pointsParticipant, v.pointsStaff, v.tags,
                v.latitude, v.longitude);
        ACTIVITIES.save(activity);

        return Response.created(URI.create("/rest/activities/" + id))
                .entity(activity)
                .build();
    }

    // --- B2-6: list ----------------------------------------------------------

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response list(
            @Context ContainerRequestContext ctx,
            @QueryParam("status") @DefaultValue("PUBLISHED") String statusParam,
            @QueryParam("limit") @DefaultValue("20") int limitParam,
            @QueryParam("cursor") String cursor) {

        AuthenticatedUser caller = authUser(ctx);
        ActivityStatus status = parseStatusFilter(statusParam);
        int limit = Math.max(1, Math.min(limitParam, MAX_LIMIT));
        if (limit == 0) limit = DEFAULT_LIMIT;

        ActivityPage page = ACTIVITIES.list(status, limit, cursor);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Activity a : page.items()) items.add(view(a, caller.userId()));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", items);
        body.put("nextCursor", page.nextCursor());
        return Response.ok(body).build();
    }

    // --- B2-7: detail --------------------------------------------------------

    @GET
    @Path("/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response get(@Context ContainerRequestContext ctx, @PathParam("id") String id) {
        AuthenticatedUser caller = authUser(ctx);
        Activity activity = ACTIVITIES.findById(id)
                .orElseThrow(() -> new NotFoundException("No activity with id " + id + "."));
        return Response.ok(view(activity, caller.userId())).build();
    }

    // --- B2-4: edit (owner-only) --------------------------------------------

    @PUT
    @Path("/{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response update(@Context ContainerRequestContext ctx,
                           @PathParam("id") String id,
                           ActivityRequest req) {
        AuthenticatedUser caller = authUser(ctx);
        Activity existing = ACTIVITIES.findById(id)
                .orElseThrow(() -> new NotFoundException("No activity with id " + id + "."));

        OwnershipGuard.requireOwnerOrPrivileged(caller, existing.ownerId());

        Validated v = validate(req);
        Activity updated = new Activity(
                existing.id(), existing.ownerId(),
                v.title, v.description, v.category, v.location,
                v.startsAt, v.endsAt, v.capacity,
                existing.status(),          // status changes go through /cancel, not PUT
                existing.createdAt(), Instant.now(),
                v.eventKind, v.host, v.distanceKm, v.verifiedBy,
                v.staffCapacity, v.pointsParticipant, v.pointsStaff, v.tags,
                v.latitude, v.longitude);
        ACTIVITIES.save(updated);
        return Response.ok(updated).build();
    }

    // --- B2-5: cancel (owner-only soft state change) ------------------------

    @POST
    @Path("/{id}/cancel")
    @Produces(MediaType.APPLICATION_JSON)
    public Response cancel(@Context ContainerRequestContext ctx, @PathParam("id") String id) {
        AuthenticatedUser caller = authUser(ctx);
        Activity existing = ACTIVITIES.findById(id)
                .orElseThrow(() -> new NotFoundException("No activity with id " + id + "."));

        OwnershipGuard.requireOwnerOrPrivileged(caller, existing.ownerId());

        if (existing.status() == ActivityStatus.CANCELLED) {
            return Response.ok(existing).build(); // idempotent
        }
        Activity cancelled = new Activity(
                existing.id(), existing.ownerId(), existing.title(), existing.description(),
                existing.category(), existing.location(), existing.startsAt(), existing.endsAt(),
                existing.capacity(), ActivityStatus.CANCELLED,
                existing.createdAt(), Instant.now(),
                existing.eventKind(), existing.host(), existing.distanceKm(), existing.verifiedBy(),
                existing.staffCapacity(), existing.pointsParticipant(), existing.pointsStaff(),
                existing.tags(), existing.latitude(), existing.longitude());
        ACTIVITIES.save(cancelled);
        return Response.ok(cancelled).build();
    }

    // --- backoffice approval (B4-10) ----------------------------------------

    @POST
    @Path("/{id}/approve")
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({Role.BACKOFFICE, Role.SYSADMIN})
    public Response approve(@PathParam("id") String id) {
        return moderate(id, ActivityStatus.PUBLISHED);
    }

    @POST
    @Path("/{id}/reject")
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({Role.BACKOFFICE, Role.SYSADMIN})
    public Response reject(@PathParam("id") String id) {
        return moderate(id, ActivityStatus.REJECTED);
    }

    /** Shared approve/reject: only a PENDING_APPROVAL activity can be moderated. */
    private Response moderate(String id, ActivityStatus target) {
        Activity existing = ACTIVITIES.findById(id)
                .orElseThrow(() -> new NotFoundException("No activity with id " + id + "."));
        if (existing.status() != ActivityStatus.PENDING_APPROVAL) {
            throw new ValidationException(
                    "Only activities pending approval can be approved or rejected.");
        }
        Activity moderated = new Activity(
                existing.id(), existing.ownerId(), existing.title(), existing.description(),
                existing.category(), existing.location(), existing.startsAt(), existing.endsAt(),
                existing.capacity(), target,
                existing.createdAt(), Instant.now(),
                existing.eventKind(), existing.host(), existing.distanceKm(), existing.verifiedBy(),
                existing.staffCapacity(), existing.pointsParticipant(), existing.pointsStaff(),
                existing.tags(), existing.latitude(), existing.longitude());
        ACTIVITIES.save(moderated);
        return Response.ok(moderated).build();
    }

    // --- helpers -------------------------------------------------------------

    static AuthenticatedUser authUser(ContainerRequestContext ctx) {
        Object u = ctx.getProperty(JwtAuthFilter.USER_PROPERTY);
        if (!(u instanceof AuthenticatedUser user)) {
            throw new UnauthorizedException("Authentication required.");
        }
        return user;
    }

    /** Privileged roles bypass the verified gate; others must be verified (D-1). */
    private void requireVerified(AuthenticatedUser caller) {
        if (OwnershipGuard.isPrivileged(caller.role())) return;
        User u = USERS.findById(caller.userId())
                .orElseThrow(() -> new UnauthorizedException("User no longer exists."));
        if (!u.verified()) {
            throw new ForbiddenException(
                    "ACCOUNT_NOT_VERIFIED",
                    "Your account must be verified by a backoffice before you can create activities.");
        }
    }

    private static ActivityStatus parseStatusFilter(String s) {
        if (s == null || s.isBlank() || "ALL".equalsIgnoreCase(s)) return null;
        try {
            return ActivityStatus.valueOf(s.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ValidationException("Unknown status filter: " + s);
        }
    }

    /** Parsed + validated activity fields (incl. volunteer extensions). */
    private record Validated(String title, String description, String category, String location,
                             Instant startsAt, Instant endsAt, int capacity,
                             EventKind eventKind, String host, double distanceKm, VerifiedBy verifiedBy,
                             int staffCapacity, int pointsParticipant, int pointsStaff, List<String> tags,
                             Double latitude, Double longitude) {
    }

    private static Validated validate(ActivityRequest req) {
        if (req == null) throw new ValidationException("Request body is required.");

        String title = trimOrNull(req.title);
        if (title == null) throw new ValidationException("Title is required.");

        if (req.startsAt == null || req.endsAt == null) {
            throw new ValidationException("startsAt and endsAt are required.");
        }
        Instant startsAt;
        Instant endsAt;
        try {
            startsAt = Instant.parse(req.startsAt.trim());
            endsAt = Instant.parse(req.endsAt.trim());
        } catch (DateTimeException e) {
            throw new ValidationException("startsAt and endsAt must be ISO-8601 instants, e.g. 2026-07-01T18:00:00Z.");
        }
        if (!endsAt.isAfter(startsAt)) {
            throw new ValidationException("endsAt must be after startsAt.");
        }
        if (req.capacity == null || req.capacity < 1) {
            throw new ValidationException("Capacity must be at least 1.");
        }

        String description = req.description == null ? "" : req.description.trim();
        String category = req.category == null ? "" : req.category.trim();
        String location = req.location == null ? "" : req.location.trim();

        // --- volunteer-event extensions (all optional) ------------------------
        EventKind eventKind = parseEnum(req.eventKind, EventKind.class, EventKind.RUN, "eventKind");
        VerifiedBy verifiedBy = parseEnum(req.verifiedBy, VerifiedBy.class, VerifiedBy.PEER, "verifiedBy");
        String host = req.host == null ? "" : req.host.trim();
        double distanceKm = req.distanceKm == null ? 0.0 : req.distanceKm;
        if (distanceKm < 0) throw new ValidationException("distanceKm cannot be negative.");
        int staffCapacity = nonNegative(req.staffCapacity, "staffCapacity");
        int pointsParticipant = nonNegative(req.pointsParticipant, "pointsParticipant");
        int pointsStaff = nonNegative(req.pointsStaff, "pointsStaff");

        List<String> tags = new ArrayList<>();
        if (req.tags != null) {
            for (String t : req.tags) {
                if (t == null) continue;
                String tag = t.trim().toLowerCase();
                if (!tag.isEmpty()) tags.add(tag);
            }
        }

        // Optional location pin: both coordinates together, within valid ranges.
        Double latitude = req.latitude;
        Double longitude = req.longitude;
        if ((latitude == null) != (longitude == null)) {
            throw new ValidationException("latitude and longitude must be provided together.");
        }
        if (latitude != null && (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) {
            throw new ValidationException("latitude must be in [-90,90] and longitude in [-180,180].");
        }

        return new Validated(title, description, category, location, startsAt, endsAt, req.capacity,
                eventKind, host, distanceKm, verifiedBy, staffCapacity, pointsParticipant, pointsStaff, tags,
                latitude, longitude);
    }

    private static <E extends Enum<E>> E parseEnum(String raw, Class<E> type, E fallback, String field) {
        if (raw == null || raw.isBlank()) return fallback;
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ValidationException("Unknown " + field + ": " + raw);
        }
    }

    private static int nonNegative(Integer value, String field) {
        if (value == null) return 0;
        if (value < 0) throw new ValidationException(field + " cannot be negative.");
        return value;
    }

    /** Activity fields + derived participation counts + the caller's role. */
    private Map<String, Object> view(Activity a, String callerId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.id());
        m.put("ownerId", a.ownerId());
        m.put("title", a.title());
        m.put("description", a.description());
        m.put("category", a.category());
        m.put("location", a.location());
        m.put("startsAt", a.startsAt().toString());
        m.put("endsAt", a.endsAt().toString());
        m.put("capacity", a.capacity());
        m.put("status", a.status().name());
        m.put("createdAt", a.createdAt().toString());
        m.put("updatedAt", a.updatedAt().toString());
        m.put("eventKind", a.eventKind().name());
        m.put("host", a.host());
        m.put("distanceKm", a.distanceKm());
        m.put("verifiedBy", a.verifiedBy().name());
        m.put("staffCapacity", a.staffCapacity());
        m.put("pointsParticipant", a.pointsParticipant());
        m.put("pointsStaff", a.pointsStaff());
        m.put("tags", a.tags());
        m.put("latitude", a.latitude());
        m.put("longitude", a.longitude());
        m.put("participantsJoined", PARTICIPANTS.countByActivityAndRole(a.id(), ParticipationRole.PARTICIPANT));
        m.put("staffJoined", PARTICIPANTS.countByActivityAndRole(a.id(), ParticipationRole.STAFF));
        m.put("userRole", PARTICIPANTS.findRole(a.id(), callerId).map(Enum::name).orElse(null));
        return m;
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
