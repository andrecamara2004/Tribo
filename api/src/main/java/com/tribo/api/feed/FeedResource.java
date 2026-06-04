package com.tribo.api.feed;

import com.tribo.api.activity.Activity;
import com.tribo.api.activity.ActivityRepository;
import com.tribo.api.activity.EventKind;
import com.tribo.api.activity.Participation;
import com.tribo.api.activity.ParticipationRepository;
import com.tribo.api.activity.ParticipationRole;
import com.tribo.api.clan.Clan;
import com.tribo.api.clan.ClanRepository;
import com.tribo.api.error.ForbiddenException;
import com.tribo.api.error.NotFoundException;
import com.tribo.api.error.UnauthorizedException;
import com.tribo.api.error.ValidationException;
import com.tribo.api.iam.AuthenticatedUser;
import com.tribo.api.iam.AvatarColor;
import com.tribo.api.iam.JwtAuthFilter;
import com.tribo.api.iam.OwnershipGuard;
import com.tribo.api.iam.User;
import com.tribo.api.iam.UserRepository;
import com.tribo.api.run.Run;
import com.tribo.api.run.RunRepository;

import jakarta.ws.rs.Consumes;
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

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Activity feed (Sprint 3 Phase 4) + minimal kudos (D-5).
 *
 *   GET    /rest/feed                     unified run + volunteer timeline
 *   POST   /rest/feed/{itemId}/kudos      like   (idempotent)
 *   DELETE /rest/feed/{itemId}/kudos      unlike (idempotent)
 *
 * The feed is aggregated per request (no stored timeline): recent runs + recent
 * volunteer joins, denormalised with author info, sorted newest-first in memory.
 * Fine at this scale; revisit with a materialised feed + cursors if it grows.
 */
@Path("/feed")
public class FeedResource {

    private static final RunRepository RUNS = new RunRepository();
    private static final ParticipationRepository PARTICIPANTS = new ParticipationRepository();
    private static final ActivityRepository ACTIVITIES = new ActivityRepository();
    private static final UserRepository USERS = new UserRepository();
    private static final ClanRepository CLANS = new ClanRepository();
    private static final KudosRepository KUDOS = new KudosRepository();
    private static final CommentRepository COMMENTS = new CommentRepository();

    private static final int DEFAULT_LIMIT = 30;
    private static final int MAX_LIMIT = 100;
    private static final int FETCH_BUDGET = 200; // how many recent runs to scan

    private record Entry(Instant when, Map<String, Object> data) {}

    // --- GET /feed -----------------------------------------------------------

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response feed(@Context ContainerRequestContext ctx,
                         @QueryParam("scope") @DefaultValue("all") String scope,
                         @QueryParam("limit") @DefaultValue("30") int limitParam) {
        AuthenticatedUser caller = authUser(ctx);
        int limit = Math.max(1, Math.min(limitParam, MAX_LIMIT));
        if (limit == 0) limit = DEFAULT_LIMIT;

        // Clan scope → restrict to the caller's clan members (incl. themselves).
        Set<String> members = null;
        if ("clan".equalsIgnoreCase(scope)) {
            String clanId = USERS.findById(caller.userId()).map(User::clanId).orElse(null);
            members = clanId == null ? Set.of(caller.userId())
                    : new HashSet<>(USERS.findIdsByClan(clanId));
        }

        Map<String, User> userCache = new HashMap<>();
        Map<String, Clan> clanCache = new HashMap<>();
        Map<String, Activity> activityCache = new HashMap<>();
        List<Entry> entries = new ArrayList<>();

        // Runs.
        for (Run r : RUNS.listRecent(FETCH_BUDGET)) {
            if (members != null && !members.contains(r.userId())) continue;
            Map<String, Object> m = base(r.id(), "run", r.startedAt(), r.title(), r.location(),
                    author(r.userId(), userCache, clanCache), caller.userId());
            double km = Math.round(r.distanceMeters() / 100.0) / 10.0;
            m.put("distanceKm", km);
            m.put("durationSeconds", r.durationSeconds());
            m.put("paceSecPerKm", km > 0 ? (int) Math.round(r.durationSeconds() / km) : 0);
            m.put("elevationMeters", r.elevationMeters());
            m.put("routeType", r.routeType());
            entries.add(new Entry(r.startedAt(), m));
        }

        // Volunteer joins (participations on VOLUNTEER activities).
        for (Participation p : PARTICIPANTS.listAll()) {
            if (members != null && !members.contains(p.userId())) continue;
            Activity a = activityCache.computeIfAbsent(p.activityId(),
                    id -> ACTIVITIES.findById(id).orElse(null));
            if (a == null || a.eventKind() != EventKind.VOLUNTEER) continue;
            String id = p.activityId() + ":" + p.userId();
            Map<String, Object> m = base(id, "volunteer", p.joinedAt(), a.title(), a.location(),
                    author(p.userId(), userCache, clanCache), caller.userId());
            m.put("role", p.role().name());
            m.put("pointsEarned", p.role() == ParticipationRole.STAFF ? a.pointsStaff() : a.pointsParticipant());
            m.put("verifiedBy", a.verifiedBy().name());
            m.put("distanceKm", a.distanceKm());
            entries.add(new Entry(p.joinedAt(), m));
        }

        entries.sort(Comparator.comparing(Entry::when).reversed());
        List<Map<String, Object>> items = new ArrayList<>();
        for (Entry e : entries.subList(0, Math.min(limit, entries.size()))) items.add(e.data());

        return Response.ok(Map.of("items", items)).build();
    }

    // --- kudos ---------------------------------------------------------------

    @POST
    @Path("/{itemId}/kudos")
    @Produces(MediaType.APPLICATION_JSON)
    public Response like(@Context ContainerRequestContext ctx, @PathParam("itemId") String itemId) {
        AuthenticatedUser caller = authUser(ctx);
        KUDOS.add(itemId, caller.userId());
        return Response.ok(Map.of(
                "itemId", itemId,
                "kudosCount", KUDOS.countByItem(itemId),
                "likedByMe", true)).build();
    }

    @DELETE
    @Path("/{itemId}/kudos")
    public Response unlike(@Context ContainerRequestContext ctx, @PathParam("itemId") String itemId) {
        AuthenticatedUser caller = authUser(ctx);
        KUDOS.remove(itemId, caller.userId());
        return Response.noContent().build();
    }

    // --- comments (Phase 6) --------------------------------------------------

    @GET
    @Path("/{itemId}/comments")
    @Produces(MediaType.APPLICATION_JSON)
    public Response comments(@Context ContainerRequestContext ctx, @PathParam("itemId") String itemId) {
        authUser(ctx);
        Map<String, User> userCache = new HashMap<>();
        Map<String, Clan> clanCache = new HashMap<>();
        List<Map<String, Object>> items = new ArrayList<>();
        for (Comment c : COMMENTS.listByItem(itemId)) items.add(commentView(c, userCache, clanCache));
        return Response.ok(Map.of("items", items)).build();
    }

    @POST
    @Path("/{itemId}/comments")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response addComment(@Context ContainerRequestContext ctx, @PathParam("itemId") String itemId,
                               CommentRequest req) {
        AuthenticatedUser caller = authUser(ctx);
        String text = req == null || req.text == null ? "" : req.text.trim();
        if (text.isEmpty()) throw new ValidationException("Comment text is required.");
        Comment c = new Comment(UUID.randomUUID().toString(), itemId, caller.userId(), text, Instant.now());
        COMMENTS.save(c);
        return Response.created(URI.create("/rest/feed/" + itemId + "/comments/" + c.id()))
                .entity(commentView(c, new HashMap<>(), new HashMap<>()))
                .build();
    }

    @DELETE
    @Path("/{itemId}/comments/{commentId}")
    public Response deleteComment(@Context ContainerRequestContext ctx,
                                  @PathParam("itemId") String itemId,
                                  @PathParam("commentId") String commentId) {
        AuthenticatedUser caller = authUser(ctx);
        Comment c = COMMENTS.findById(commentId)
                .orElseThrow(() -> new NotFoundException("No comment with id " + commentId + "."));
        if (!c.userId().equals(caller.userId()) && !OwnershipGuard.isPrivileged(caller.role())) {
            throw new ForbiddenException("You can only delete your own comments.");
        }
        COMMENTS.delete(commentId);
        return Response.noContent().build();
    }

    private Map<String, Object> commentView(Comment c, Map<String, User> userCache, Map<String, Clan> clanCache) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.id());
        m.put("text", c.text());
        m.put("createdAt", c.createdAt().toString());
        m.put("author", author(c.userId(), userCache, clanCache));
        return m;
    }

    public static class CommentRequest {
        public String text;
    }

    // --- helpers -------------------------------------------------------------

    private Map<String, Object> base(String id, String type, Instant when, String title,
                                     String location, Map<String, Object> author, String callerId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("type", type);
        m.put("when", when.toString());
        m.put("author", author);
        m.put("title", title);
        m.put("location", location);
        m.put("kudosCount", KUDOS.countByItem(id));
        m.put("likedByMe", KUDOS.exists(id, callerId));
        m.put("commentCount", COMMENTS.countByItem(id));
        return m;
    }

    private Map<String, Object> author(String userId, Map<String, User> userCache, Map<String, Clan> clanCache) {
        User u = userCache.computeIfAbsent(userId, id -> USERS.findById(id).orElse(null));
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("userId", userId);
        a.put("name", u != null ? u.fullName() : "Unknown");
        String clanName = null;
        String color = AvatarColor.forId(userId);
        if (u != null && u.clanId() != null) {
            Clan c = clanCache.computeIfAbsent(u.clanId(), id -> CLANS.findById(id).orElse(null));
            if (c != null) {
                clanName = c.name();
                color = c.color();
            }
        }
        a.put("clanName", clanName);
        a.put("color", color);
        return a;
    }

    static AuthenticatedUser authUser(ContainerRequestContext ctx) {
        Object u = ctx.getProperty(JwtAuthFilter.USER_PROPERTY);
        if (!(u instanceof AuthenticatedUser user)) {
            throw new UnauthorizedException("Authentication required.");
        }
        return user;
    }
}
