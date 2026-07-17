package com.tribo.api.clan;

import com.tribo.api.activity.Activity;
import com.tribo.api.activity.ActivityRepository;
import com.tribo.api.activity.EventKind;
import com.tribo.api.activity.Participation;
import com.tribo.api.activity.ParticipationRepository;
import com.tribo.api.activity.ParticipationRole;
import com.tribo.api.error.ForbiddenException;
import com.tribo.api.error.NotFoundException;
import com.tribo.api.error.UnauthorizedException;
import com.tribo.api.error.ValidationException;
import com.tribo.api.iam.AuthenticatedUser;
import com.tribo.api.iam.JwtAuthFilter;
import com.tribo.api.iam.ProfilePrivacy;
import com.tribo.api.iam.UserRepository;
import com.tribo.api.run.Run;
import com.tribo.api.run.RunRepository;
import com.tribo.api.iam.User;
import com.tribo.api.StorageService;

import org.glassfish.jersey.media.multipart.FormDataContentDisposition;
import org.glassfish.jersey.media.multipart.FormDataParam;
import java.io.InputStream;

import jakarta.ws.rs.Consumes;
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
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Clan endpoints (Sprint 3 Phase 1, D-3).
 *
 * POST /rest/clans create + auto-join (any authenticated user)
 * GET /rest/clans list with member counts
 * GET /rest/clans/{id} detail with member count
 * POST /rest/clans/{id}/join caller joins (switches clans)
 * POST /rest/clans/leave caller leaves
 *
 * Membership is the user's nullable clanId (one clan per user); there is no
 * separate membership entity. Authentication is enforced for the whole class by
 * JwtAuthFilter (no @PublicEndpoint); no role gating — any signed-in user may
 * form or join a clan.
 */
@Path("/clans")
public class ClanResource {

    private static final ClanRepository CLANS = new ClanRepository();
    private static final ClanMessageRepository MESSAGES = new ClanMessageRepository();
    private static final UserRepository USERS = new UserRepository();
    private static final RunRepository RUNS = new RunRepository();
    private static final ParticipationRepository PARTICIPANTS = new ParticipationRepository();
    private static final ActivityRepository ACTIVITIES = new ActivityRepository();
    private static final RankSnapshotRepository SNAPSHOTS = new RankSnapshotRepository();

    private static final Set<String> METRICS = Set.of("avgPace", "distance", "consistency", "impact", "quality");
    private static final Set<String> PERIODS = Set.of("all", "month", "week");

    private static final Pattern TAG = Pattern.compile("^[A-Z0-9]{2,5}$");
    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");

    // --- create --------------------------------------------------------------

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response create(@Context ContainerRequestContext ctx, ClanRequest req) {
        AuthenticatedUser caller = authUser(ctx);
        User me = USERS.findById(caller.userId()).orElseThrow(() -> new NotFoundException("User not found."));
        if (me.clanId() != null) {
            throw new ValidationException("You are already in a clan.");
        }
        Validated v = validate(req);

        String id = UUID.randomUUID().toString();
        Clan clan = new Clan(id, v.name, v.tag, v.color, caller.userId(), Instant.now(), null);
        CLANS.save(clan);

        // Creator auto-joins (switches from any current clan).
        USERS.setClan(caller.userId(), id);

        return Response.created(URI.create("/rest/clans/" + id))
                .entity(view(clan))
                .build();
    }

    // --- picture upload ------------------------------------------------------

    @POST
    @Path("/{id}/picture")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    public Response uploadPicture(
            @Context ContainerRequestContext ctx,
            @PathParam("id") String id,
            @FormDataParam("file") InputStream fileInputStream,
            @FormDataParam("file") FormDataContentDisposition fileDetail) {

        AuthenticatedUser caller = authUser(ctx);
        Clan clan = CLANS.findById(id).orElseThrow(() -> new NotFoundException("Clan not found."));

        if (!clan.ownerId().equals(caller.userId())) {
            throw new ForbiddenException("Only the clan owner can change the clan picture.");
        }

        if (fileInputStream == null || fileDetail == null) {
            throw new ValidationException("No file uploaded");
        }

        // Upload to GCS
        String contentType = "image/jpeg";
        if (fileDetail.getFileName() != null && fileDetail.getFileName().toLowerCase().endsWith(".png")) {
            contentType = "image/png";
        }

        String pictureUrl = StorageService.uploadImage(fileInputStream, contentType);

        // Update Clan
        Clan updated = new Clan(clan.id(), clan.name(), clan.tag(), clan.color(), clan.ownerId(), clan.createdAt(),
                pictureUrl);
        CLANS.save(updated);

        return Response.ok(view(updated)).build();
    }

    // --- list ----------------------------------------------------------------

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response list() {
        List<Map<String, Object>> items = CLANS.list().stream().map(this::view).toList();
        return Response.ok(Map.of("items", items)).build();
    }

    // --- ranking (Sprint 3 Phase 5) -----------------------------------------
    // Literal /ranking is matched ahead of /{id} by JAX-RS path specificity.

    @GET
    @Path("/ranking")
    @Produces(MediaType.APPLICATION_JSON)
    public Response ranking(@QueryParam("metric") @DefaultValue("avgPace") String metric,
            @QueryParam("period") @DefaultValue("all") String period) {
        if (!METRICS.contains(metric))
            throw new ValidationException("Unknown metric: " + metric);
        if (!PERIODS.contains(period))
            throw new ValidationException("Unknown period: " + period);

        List<Clan> clans = CLANS.list();

        // userId → clanId, and member counts.
        Map<String, String> userClan = new HashMap<>();
        Map<String, Integer> members = new HashMap<>();
        Map<String, Agg> aggs = new HashMap<>();
        for (Clan c : clans) {
            List<String> ids = USERS.findIdsByClan(c.id());
            members.put(c.id(), ids.size());
            aggs.put(c.id(), new Agg());
            for (String uid : ids)
                userClan.put(uid, c.id());
        }

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate sunday = monday.plusDays(6);

        for (Run r : RUNS.all()) {
            String cid = userClan.get(r.userId());
            if (cid == null)
                continue;
            Agg a = aggs.get(cid);
            a.meters += r.distanceMeters();
            a.seconds += r.durationSeconds();
            LocalDate d = r.startedAt().atZone(ZoneOffset.UTC).toLocalDate();
            if (!d.isBefore(monday) && !d.isAfter(sunday)) {
                a.weekMeters += r.distanceMeters();
                a.activeThisWeek.add(r.userId());
            }
            if (d.getYear() == today.getYear() && d.getMonthValue() == today.getMonthValue()) {
                a.monthMeters += r.distanceMeters();
            }
        }

        Map<String, Activity> actCache = new HashMap<>();
        for (Participation p : PARTICIPANTS.listAll()) {
            String cid = userClan.get(p.userId());
            if (cid == null)
                continue;
            Activity act = actCache.computeIfAbsent(p.activityId(), id -> ACTIVITIES.findById(id).orElse(null));
            if (act == null || act.eventKind() != EventKind.VOLUNTEER)
                continue;
            Agg a = aggs.get(cid);
            a.volEvents++;
            a.volPoints += p.role() == ParticipationRole.STAFF ? act.pointsStaff() : act.pointsParticipant();
        }

        // Quality: how well-rated are the events a clan's members host. Averaged
        // across every reviewed activity owned by a member, weighted by how many
        // reviews each activity has.
        for (Activity act : ACTIVITIES.listByRating()) {
            if (act.reviewCount() <= 0)
                continue;
            String cid = userClan.get(act.ownerId());
            if (cid == null)
                continue;
            Agg a = aggs.get(cid);
            a.ratingWeightedSum += act.averageRating() * act.reviewCount();
            a.reviewCount += act.reviewCount();
        }

        List<RankRow> rows = new ArrayList<>();
        for (Clan c : clans) {
            Agg a = aggs.get(c.id());
            int memberCount = members.getOrDefault(c.id(), 0);
            Integer avgPace = a.meters > 0 ? (int) Math.round(a.seconds / (a.meters / 1000.0)) : null;
            int consistency = memberCount > 0 ? (int) Math.round(a.activeThisWeek.size() * 100.0 / memberCount) : 0;
            Double qualityRating = a.reviewCount > 0 ? round1(a.ratingWeightedSum / a.reviewCount) : null;
            rows.add(new RankRow(c, memberCount,
                    round1(a.meters / 1000.0), round1(a.monthMeters / 1000.0), round1(a.weekMeters / 1000.0),
                    avgPace, consistency, a.volPoints, a.volEvents, qualityRating, a.reviewCount));
        }

        rows.sort(comparatorFor(metric, period));

        String thisWeek = isoWeek(today);
        String lastWeek = isoWeek(today.minusWeeks(1));

        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            RankRow r = rows.get(i);
            int rank = i + 1;
            // Trend vs the same metric+period a week ago; flat if no prior snapshot.
            Integer prev = SNAPSHOTS.getRank(metric, period, lastWeek, r.clan().id()).orElse(null);
            String trend = prev == null ? "flat" : rank < prev ? "up" : rank > prev ? "down" : "flat";
            SNAPSHOTS.put(metric, period, thisWeek, r.clan().id(), rank); // record this week
            out.add(r.toMap(rank, trend));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("metric", metric);
        body.put("period", period);
        body.put("updatedAt", Instant.now().toString());
        body.put("clans", out);
        return Response.ok(body).build();
    }

    private static Comparator<RankRow> comparatorFor(String metric, String period) {
        return switch (metric) {
            case "distance" -> Comparator.comparingDouble((RankRow r) -> r.distanceFor(period)).reversed();
            case "consistency" -> Comparator.comparingInt((RankRow r) -> r.consistencyPct).reversed();
            case "impact" -> Comparator.comparingLong((RankRow r) -> r.volunteerPoints).reversed();
            // quality: highest average rating first; clans with no reviews sort last.
            case "quality" -> Comparator.comparingDouble(
                    (RankRow r) -> r.qualityRating == null ? -1.0 : r.qualityRating).reversed();
            // avgPace: faster first; clans with no runs (null) sort last.
            default -> Comparator.comparingInt(r -> r.avgPaceSecPerKm == null ? Integer.MAX_VALUE : r.avgPaceSecPerKm);
        };
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    /**
     * ISO week label, e.g. "2026-W23" (week-based year + week-of-week-based-year).
     */
    private static String isoWeek(LocalDate d) {
        return String.format("%d-W%02d",
                d.get(IsoFields.WEEK_BASED_YEAR), d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
    }

    /** Mutable per-clan accumulator used while scanning runs/participations. */
    private static final class Agg {
        long meters;
        long seconds;
        double weekMeters;
        double monthMeters;
        long volPoints;
        int volEvents;
        double ratingWeightedSum;
        long reviewCount;
        final Set<String> activeThisWeek = new HashSet<>();
    }

    /** A computed, not-yet-ranked clan row. */
    private record RankRow(Clan clan, int members, double totalKm, double monthlyKm, double weeklyKm,
            Integer avgPaceSecPerKm, int consistencyPct, long volunteerPoints, int volunteerEvents,
            Double qualityRating, long reviewCount) {
        double distanceFor(String period) {
            return switch (period) {
                case "week" -> weeklyKm;
                case "month" -> monthlyKm;
                default -> totalKm;
            };
        }

        Map<String, Object> toMap(int rank, String trend) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("rank", rank);
            m.put("id", clan.id());
            m.put("name", clan.name());
            m.put("tag", clan.tag());
            m.put("color", clan.color());
            m.put("pictureUrl", clan.pictureUrl());
            m.put("members", members);
            m.put("totalKm", totalKm);
            m.put("monthlyKm", monthlyKm);
            m.put("weeklyKm", weeklyKm);
            m.put("avgPaceSecPerKm", avgPaceSecPerKm);
            m.put("consistencyPct", consistencyPct);
            m.put("volunteerPoints", volunteerPoints);
            m.put("volunteerEvents", volunteerEvents);
            m.put("qualityRating", qualityRating);
            m.put("reviewCount", reviewCount);
            m.put("trend", trend);
            return m;
        }
    }

    // --- chat: list messages -------------------------------------------------

    @GET
    @Path("/{id}/messages")
    @Produces(MediaType.APPLICATION_JSON)
    public Response listMessages(@Context ContainerRequestContext ctx, @PathParam("id") String clanId) {
        AuthenticatedUser caller = authUser(ctx);
        // Only clan members may read the chat.
        User me = USERS.findById(caller.userId()).orElseThrow(() -> new NotFoundException("User not found."));

        if (!clanId.equals(me.clanId())) {
            throw new ForbiddenException("You are not a member of this clan.");
        }
        CLANS.findById(clanId).orElseThrow(() -> new NotFoundException("No clan with id " + clanId + "."));

        List<Map<String, Object>> out = MESSAGES.listByClan(clanId).stream()
                .map(m -> {
                    Map<String, Object> map = new java.util.LinkedHashMap<>();
                    map.put("id", m.id());
                    map.put("userId", m.userId());
                    map.put("fullName", m.fullName());
                    map.put("text", m.text());
                    map.put("sentAt", m.sentAt().toString());
                    USERS.findById(m.userId()).ifPresent(u -> {
                        if (u.pictureUrl() != null) {
                            map.put("pictureUrl", u.pictureUrl());
                        }
                    });
                    return map;
                })
                .toList();
        return Response.ok(Map.of("messages", out)).build();
    }

    // --- chat: send message --------------------------------------------------

    @POST
    @Path("/{id}/messages")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response sendMessage(@Context ContainerRequestContext ctx, @PathParam("id") String clanId,
            Map<String, String> body) {
        AuthenticatedUser caller = authUser(ctx);
        // Only clan members may post.
        User me = USERS.findById(caller.userId()).orElseThrow(() -> new NotFoundException("User not found."));

        if (!clanId.equals(me.clanId())) {
            throw new ForbiddenException("You are not a member of this clan.");
        }
        CLANS.findById(clanId).orElseThrow(() -> new NotFoundException("No clan with id " + clanId + "."));

        String text = body == null ? null : body.get("text");
        if (text == null || text.isBlank()) {
            throw new ValidationException("Message text is required.");
        }
        text = text.trim();
        if (text.length() > 500) {
            throw new ValidationException("Message must be at most 500 characters.");
        }

        ClanMessage message = new ClanMessage(
                UUID.randomUUID().toString(),
                clanId,
                caller.userId(),
                me.fullName(),
                text,
                Instant.now());
        MESSAGES.save(message);

        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("id", message.id());
        out.put("userId", message.userId());
        out.put("fullName", message.fullName());
        out.put("text", message.text());
        out.put("sentAt", message.sentAt().toString());
        if (me.pictureUrl() != null) {
            out.put("pictureUrl", me.pictureUrl());
        }

        return Response.status(Response.Status.CREATED).entity(out).build();
    }

    // --- detail --------------------------------------------------------------

    @GET
    @Path("/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response get(@PathParam("id") String id) {
        Clan clan = CLANS.findById(id)
                .orElseThrow(() -> new NotFoundException("No clan with id " + id + "."));
        return Response.ok(view(clan)).build();
    }

    // --- join ----------------------------------------------------------------

    @POST
    @Path("/{id}/join")
    @Produces(MediaType.APPLICATION_JSON)
    public Response join(@Context ContainerRequestContext ctx, @PathParam("id") String id) {
        AuthenticatedUser caller = authUser(ctx);
        User me = USERS.findById(caller.userId()).orElseThrow(() -> new NotFoundException("User not found."));
        if (me.clanId() != null) {
            throw new ValidationException("You are already in a clan.");
        }
        long memberCount = USERS.countByClan(id);
        if (memberCount >= 50) {
            throw new ValidationException("This clan already has the maximum of 50 members.");
        }
        Clan clan = CLANS.findById(id)
                .orElseThrow(() -> new NotFoundException("No clan with id " + id + "."));
        USERS.setClan(caller.userId(), id);
        return Response.ok(view(clan)).build();
    }

    // --- leave ---------------------------------------------------------------

    @POST
    @Path("/leave")
    public Response leave(@Context ContainerRequestContext ctx) {
        AuthenticatedUser caller = authUser(ctx);
        USERS.setClan(caller.userId(), null); // idempotent when not in a clan
        return Response.noContent().build();
    }

    // --- members -------------------------------------------------------------

    @GET
    @Path("/{id}/members")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getMembers(@Context ContainerRequestContext ctx, @PathParam("id") String id) {
        AuthenticatedUser caller = authUser(ctx);
        CLANS.findById(id).orElseThrow(() -> new NotFoundException("No clan with id " + id + "."));

        List<Map<String, Object>> members = USERS.findIdsByClan(id).stream()
                .map(userId -> USERS.findById(userId))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .map(u -> {
                    // PRIVATE members are masked to everyone except themselves and
                    // privileged roles — so browsing a roster can't reveal them.
                    boolean reveal = ProfilePrivacy.canSeeIdentity(caller, u);
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", u.id());
                    m.put("fullName", reveal ? u.fullName() : ProfilePrivacy.MASKED_NAME);
                    m.put("role", u.role().name());
                    m.put("pictureUrl", reveal ? u.pictureUrl() : null);
                    m.put("private", !reveal);
                    return m;
                })
                .toList();

        return Response.ok(members).build();
    }

    // --- helpers -------------------------------------------------------------

    /** Reads the authenticated caller from JwtAuthFilter's request property. */
    static AuthenticatedUser authUser(ContainerRequestContext ctx) {
        Object u = ctx.getProperty(JwtAuthFilter.USER_PROPERTY);
        if (!(u instanceof AuthenticatedUser user)) {
            throw new UnauthorizedException("Authentication required.");
        }
        return user;
    }

    /** Clan + derived memberCount, in a stable field order. */
    private Map<String, Object> view(Clan c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.id());
        m.put("name", c.name());
        m.put("tag", c.tag());
        m.put("color", c.color());
        m.put("pictureUrl", c.pictureUrl());
        m.put("ownerId", c.ownerId());
        m.put("createdAt", c.createdAt().toString());
        m.put("memberCount", USERS.countByClan(c.id()));
        return m;
    }

    private record Validated(String name, String tag, String color) {
    }

    private static Validated validate(ClanRequest req) {
        if (req == null)
            throw new ValidationException("Request body is required.");

        String name = req.name == null ? null : req.name.trim();
        if (name == null || name.isEmpty()) {
            throw new ValidationException("Clan name is required.");
        }
        String tag = req.tag == null ? null : req.tag.trim().toUpperCase();
        if (tag == null || !TAG.matcher(tag).matches()) {
            throw new ValidationException("Tag must be 2–5 letters/digits, e.g. FOR.");
        }
        String color = req.color == null ? null : req.color.trim();
        if (color == null || !COLOR.matcher(color).matches()) {
            throw new ValidationException("Color must be a hex value like #00B86B.");
        }
        return new Validated(name, tag, color);
    }
}
