package com.tribo.api;

import com.tribo.api.activity.VolunteerStats;
import com.tribo.api.clan.Clan;
import com.tribo.api.clan.ClanRepository;
import com.tribo.api.error.NotFoundException;
import com.tribo.api.error.UnauthorizedException;
import com.tribo.api.error.ValidationException;
import com.tribo.api.iam.AllowedRoles;
import com.tribo.api.iam.AuthenticatedUser;
import com.tribo.api.iam.AvatarColor;
import com.tribo.api.iam.JwtAuthFilter;
import com.tribo.api.iam.Role;
import com.tribo.api.iam.User;
import com.tribo.api.iam.UserRepository;
import com.tribo.api.run.Run;
import com.tribo.api.run.RunRepository;
import com.tribo.api.run.RunStats;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * User endpoints.
 *
 *   GET  /rest/users/me          — full profile of the caller (Sprint 3).
 *   POST /rest/users/{id}/verify — backoffice verifies a self-registered
 *                                  ACTIVITY_MANAGER / PARTNER so they may act.
 *
 * Authentication is enforced by JwtAuthFilter. /me is any authenticated role;
 * /verify is restricted to BACKOFFICE / SYSADMIN via @AllowedRoles.
 */
@Path("/users")
public class UsersResource {

    private static final UserRepository USERS = new UserRepository();
    private static final ClanRepository CLANS = new ClanRepository();
    private static final RunRepository RUNS = new RunRepository();

    // --- GET /users/me — full profile (Sprint 3) -----------------------------

    @GET
    @Path("/me")
    @Produces(MediaType.APPLICATION_JSON)
    public Response me(@Context ContainerRequestContext ctx) {
        AuthenticatedUser caller = authUser(ctx);
        User u = USERS.findById(caller.userId())
                .orElseThrow(() -> new UnauthorizedException("User no longer exists."));

        ClanRef clan = null;
        if (u.clanId() != null) {
            Optional<Clan> c = CLANS.findById(u.clanId());
            if (c.isPresent()) {
                Clan cl = c.get();
                clan = new ClanRef(cl.id(), cl.name(), cl.tag(), cl.color());
            }
            // If the clan was deleted out from under the user, we simply report
            // no clan rather than a dangling reference.
        }

        VolunteerStats.Summary vol = VolunteerStats.summary(u.id());
        RunStats stats = RunStats.from(RUNS.listByOwner(u.id(), Integer.MAX_VALUE), Instant.now());
        MeResponse body = new MeResponse(
                u.id(), u.email(), u.fullName(), u.age(), u.role().name(),
                u.verified(), u.profileVisibility().name(), u.createdAt().toString(),
                handleFor(u.email()), AvatarColor.forId(u.id()), clan,
                vol.events(), vol.staffEligible(), vol.points(), u.weeklyGoalKm(),
                achievementsFor(stats, vol));
        return Response.ok(body).build();
    }

    // --- PUT /users/me/goal — set the weekly distance goal (Phase 6) ---------

    @PUT
    @Path("/me/goal")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response setGoal(@Context ContainerRequestContext ctx, GoalRequest req) {
        AuthenticatedUser caller = authUser(ctx);
        double km = req == null || req.weeklyGoalKm == null ? 0 : req.weeklyGoalKm;
        if (km < 0) throw new ValidationException("weeklyGoalKm cannot be negative.");
        USERS.setWeeklyGoal(caller.userId(), km);
        return me(ctx); // echo the updated profile
    }

    // --- GET /users/me/stats — derived running stats (Sprint 3 Phase 2) ------

    @GET
    @Path("/me/stats")
    @Produces(MediaType.APPLICATION_JSON)
    public Response stats(@Context ContainerRequestContext ctx) {
        AuthenticatedUser caller = authUser(ctx);
        List<Run> runs = RUNS.listByOwner(caller.userId(), Integer.MAX_VALUE);
        return Response.ok(RunStats.from(runs, Instant.now())).build();
    }

    // --- POST /users/{id}/verify (backoffice, D-1) ---------------------------

    @POST
    @Path("/{id}/verify")
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({Role.BACKOFFICE, Role.SYSADMIN})
    public Response verify(@PathParam("id") String id) {
        User updated = USERS.markVerified(id)
                .orElseThrow(() -> new NotFoundException("No user with id " + id + "."));
        return Response.ok(Map.of(
                "userId", updated.id(),
                "role", updated.role().name(),
                "verified", updated.verified()
        )).build();
    }

    // --- helpers -------------------------------------------------------------

    static AuthenticatedUser authUser(ContainerRequestContext ctx) {
        Object u = ctx.getProperty(JwtAuthFilter.USER_PROPERTY);
        if (!(u instanceof AuthenticatedUser user)) {
            throw new UnauthorizedException("Authentication required.");
        }
        return user;
    }

    /** "@" + the email local-part, lowercased and stripped to alphanumerics. */
    private static String handleFor(String email) {
        int at = email.indexOf('@');
        String local = at > 0 ? email.substring(0, at) : email;
        String cleaned = local.toLowerCase().replaceAll("[^a-z0-9]", "");
        return "@" + (cleaned.isEmpty() ? "user" : cleaned);
    }

    /** Earned badges derived from real run + volunteer data (Phase 6). */
    private static List<Achievement> achievementsFor(RunStats s, VolunteerStats.Summary vol) {
        List<Achievement> out = new ArrayList<>();
        if (s.avgPaceSecPerKm() != null && s.avgPaceSecPerKm() < 300) {
            out.add(new Achievement("🏅", "Sub-5 pace", "Avg pace under 5:00/km"));
        }
        if (s.monthKm() >= 100) {
            out.add(new Achievement("🏃", "Century month", "100+ km this month"));
        }
        if (s.streak() >= 3) {
            out.add(new Achievement("🔥", s.streak() + "-day streak", "Keep it going"));
        }
        if (vol.events() >= 3) {
            out.add(new Achievement("🌳", "Eco Runner", vol.events() + " volunteer events"));
        }
        if (vol.staffEligible()) {
            out.add(new Achievement("🛡️", "Trusted staff", "Eligible to staff events"));
        }
        return out;
    }

    /** Subset of clan fields embedded in the profile (no memberCount needed here). */
    public record ClanRef(String id, String name, String tag, String color) {
    }

    public record Achievement(String icon, String title, String sub) {
    }

    /** Body for PUT /users/me/goal. */
    public static class GoalRequest {
        public Double weeklyGoalKm;
    }

    /** Profile response — explicitly omits passwordHash and other secrets. */
    public record MeResponse(
            String userId, String email, String fullName, int age, String role,
            boolean verified, String profileVisibility, String createdAt,
            String handle, String avatarColor, ClanRef clan,
            int volunteerEvents, boolean staffEligible, long volunteerPoints,
            double weeklyGoalKm, List<Achievement> achievements) {
    }
}
