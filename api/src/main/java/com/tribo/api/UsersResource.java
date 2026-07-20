package com.tribo.api;

import com.tribo.api.activity.VolunteerStats;
import com.tribo.api.clan.Clan;
import com.tribo.api.clan.ClanRepository;
import com.tribo.api.error.ForbiddenException;
import com.tribo.api.error.NotFoundException;
import com.tribo.api.error.UnauthorizedException;
import com.tribo.api.error.ValidationException;
import com.tribo.api.iam.AllowedRoles;
import com.tribo.api.iam.AuthenticatedUser;
import com.tribo.api.iam.AvatarColor;
import com.tribo.api.iam.JwtAuthFilter;
import com.tribo.api.iam.PasswordHasher;
import com.tribo.api.iam.PasswordPolicyRepository;
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

import java.io.InputStream;
import org.glassfish.jersey.media.multipart.FormDataContentDisposition;
import org.glassfish.jersey.media.multipart.FormDataParam;

/**
 * User endpoints.
 *
 * GET /rest/users/me - full profile of the caller.
 * POST /rest/users/{id}/verify - backoffice verifies a self-registered
 * ACTIVITY_MANAGER / PARTNER so they may act.
 *
 * Authentication is enforced by JwtAuthFilter. /me is any authenticated role;
 * /verify is restricted to BACKOFFICE / SYSADMIN via @AllowedRoles.
 */
@Path("/users")
public class UsersResource {

    private static final UserRepository USERS = new UserRepository();
    private static final ClanRepository CLANS = new ClanRepository();
    private static final RunRepository RUNS = new RunRepository();
    private static final PasswordPolicyRepository PASSWORD_POLICY = new PasswordPolicyRepository();

    // Get all users
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({ Role.BACKOFFICE, Role.SYSADMIN })
    public Response listUsers() {
        List<Map<String, Object>> items = new ArrayList<>();
        for (User u : USERS.listAll()) {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("userId", u.id());
            m.put("email", u.email());
            m.put("fullName", u.fullName());
            m.put("role", u.role().name());
            m.put("verified", u.verified());
            m.put("suspended", u.suspended());
            m.put("createdAt", u.createdAt().toString());
            items.add(m);
        }
        return Response.ok(Map.of("items", items)).build();
    }

    // Get full profile

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
                clan = new ClanRef(cl.id(), cl.name(), cl.tag(), cl.color(), cl.pictureUrl());
            }
            // If the clan was deleted out from under the user, we simply report
            // no clan rather than a dangling reference.
        }

        VolunteerStats.Summary vol = VolunteerStats.summary(u.id());
        RunStats stats = RunStats.from(RUNS.listByOwner(u.id(), Integer.MAX_VALUE), Instant.now());
        MeResponse body = new MeResponse(
                u.id(), u.email(), u.fullName(), u.age(), u.birthDate(), u.role().name(),
                u.verified(), u.profileVisibility().name(), u.createdAt().toString(),
                handleFor(u.email()), AvatarColor.forId(u.id()), u.pictureUrl(), clan,
                vol.events(), vol.staffEligible(), vol.points(), u.weeklyGoalKm(),
                achievementsFor(stats, vol), u.themePreference().name());
        return Response.ok(body).build();
    }

    // Upload profile picture

    @POST
    @Path("/me/picture")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    public Response uploadPicture(
            @Context ContainerRequestContext ctx,
            @FormDataParam("file") InputStream fileInputStream,
            @FormDataParam("file") FormDataContentDisposition fileDetail) {

        AuthenticatedUser caller = authUser(ctx);
        User u = USERS.findById(caller.userId())
                .orElseThrow(() -> new UnauthorizedException("User no longer exists."));

        if (fileInputStream == null || fileDetail == null) {
            throw new ValidationException("No file uploaded");
        }

        // Upload to GCS
        // Note: For simplicity we assume jpeg/png here. Real app would check
        // fileDetail.getFileName()
        String contentType = "image/jpeg";
        if (fileDetail.getFileName() != null && fileDetail.getFileName().toLowerCase().endsWith(".png")) {
            contentType = "image/png";
        }

        String pictureUrl = StorageService.uploadImage(fileInputStream, contentType);

        // Update User
        User updated = new User(
                u.id(), u.email(), u.passwordHash(), u.fullName(), u.phoneNumber(),
                u.birthDate(), u.role(), u.profileVisibility(), u.createdAt(),
                u.suspended(), u.verified(), u.clanId(), u.weeklyGoalKm(), pictureUrl,
                u.emailVerified(), u.themePreference());
        USERS.save(updated);

        return me(ctx);
    }

    // Set weekly distance goal

    @PUT
    @Path("/me/goal")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response setGoal(@Context ContainerRequestContext ctx, GoalRequest req) {
        AuthenticatedUser caller = authUser(ctx);
        double km = req == null || req.weeklyGoalKm == null ? 0 : req.weeklyGoalKm;
        if (km < 0)
            throw new ValidationException("weeklyGoalKm cannot be negative.");
        USERS.setWeeklyGoal(caller.userId(), km);
        return me(ctx);
    }

    // Change password (requires the current password)

    @POST
    @Path("/me/password")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response changePassword(@Context ContainerRequestContext ctx, ChangePasswordRequest req) {
        AuthenticatedUser caller = authUser(ctx);
        User u = USERS.findById(caller.userId())
                .orElseThrow(() -> new UnauthorizedException("User no longer exists."));

        if (req == null || req.currentPassword == null || req.newPassword == null) {
            throw new ValidationException("currentPassword and newPassword are required.");
        }
        // The user must prove they know the current password.
        if (!PasswordHasher.verify(req.currentPassword, u.passwordHash())) {
            throw new ForbiddenException("Current password is incorrect.");
        }
        String err = PASSWORD_POLICY.get().validate(req.newPassword);
        if (err != null) {
            throw new ValidationException(err);
        }
        if (PasswordHasher.verify(req.newPassword, u.passwordHash())) {
            throw new ValidationException("New password must be different from the current one.");
        }
        USERS.updatePasswordHash(u.id(), PasswordHasher.hash(req.newPassword));
        return Response.ok(Map.of("message", "Password updated.")).build();
    }

    // Change theme preference

    @PUT
    @Path("/me/theme")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response updateTheme(@Context ContainerRequestContext ctx, ThemeRequest req) {
        AuthenticatedUser caller = authUser(ctx);
        User u = USERS.findById(caller.userId())
                .orElseThrow(() -> new UnauthorizedException("User no longer exists."));

        if (req == null || req.theme == null) {
            throw new ValidationException("Theme is required.");
        }

        User.ThemePreference pref;
        try {
            pref = User.ThemePreference.valueOf(req.theme.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ValidationException("Invalid theme.");
        }

        User updated = new User(
                u.id(), u.email(), u.passwordHash(), u.fullName(), u.phoneNumber(),
                u.birthDate(), u.role(), u.profileVisibility(), u.createdAt(),
                u.suspended(), u.verified(), u.clanId(), u.weeklyGoalKm(), u.pictureUrl(),
                u.emailVerified(), pref);
        USERS.save(updated);

        return me(ctx);
    }

    // Change profile visibility

    @PUT
    @Path("/me/visibility")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response setVisibility(@Context ContainerRequestContext ctx, VisibilityRequest req) {
        AuthenticatedUser caller = authUser(ctx);
        if (req == null || req.visibility == null) {
            throw new ValidationException("visibility is required.");
        }
        User.ProfileVisibility vis;
        try {
            vis = User.ProfileVisibility.valueOf(req.visibility.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ValidationException("visibility must be PUBLIC or PRIVATE.");
        }
        USERS.setVisibility(caller.userId(), vis);
        return me(ctx); // return the refreshed profile
    }

    // Get running stats

    @GET
    @Path("/me/stats")
    @Produces(MediaType.APPLICATION_JSON)
    public Response stats(@Context ContainerRequestContext ctx) {
        AuthenticatedUser caller = authUser(ctx);
        List<Run> runs = RUNS.listByOwner(caller.userId(), Integer.MAX_VALUE);
        return Response.ok(RunStats.from(runs, Instant.now())).build();
    }

    // Backoffice verifies user

    @POST
    @Path("/{id}/verify")
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({ Role.BACKOFFICE, Role.SYSADMIN })
    public Response verify(@PathParam("id") String id) {
        User updated = USERS.markVerified(id)
                .orElseThrow(() -> new NotFoundException("No user with id " + id + "."));
        return Response.ok(Map.of(
                "userId", updated.id(),
                "role", updated.role().name(),
                "verified", updated.verified())).build();
    }

    // Backoffice suspends user
    @POST
    @Path("/{id}/suspend")
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({ Role.BACKOFFICE, Role.SYSADMIN })
    public Response suspend(@PathParam("id") String id) {
        User target = USERS.findById(id)
                .orElseThrow(() -> new NotFoundException("No user with id " + id + "."));
        // SYSADMIN accounts are protected — no role (not even another SYSADMIN)
        // may suspend them, so the platform can't be locked out of itself.
        if (target.role() == Role.SYSADMIN) {
            throw new ForbiddenException("SYSADMIN accounts cannot be suspended.");
        }
        User updated = USERS.setSuspended(id, true)
                .orElseThrow(() -> new NotFoundException("No user with id " + id + "."));
        return Response.ok(Map.of(
                "userId", updated.id(),
                "suspended", updated.suspended())).build();
    }

    // Backoffice unsuspends user
    @POST
    @Path("/{id}/unsuspend")
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({ Role.BACKOFFICE, Role.SYSADMIN })
    public Response unsuspend(@PathParam("id") String id) {
        User updated = USERS.setSuspended(id, false)
                .orElseThrow(() -> new NotFoundException("No user with id " + id + "."));
        return Response.ok(Map.of(
                "userId", updated.id(),
                "suspended", updated.suspended())).build();
    }

    // helpers

    static AuthenticatedUser authUser(ContainerRequestContext ctx) {
        Object u = ctx.getProperty(JwtAuthFilter.USER_PROPERTY);
        if (!(u instanceof AuthenticatedUser user)) {
            throw new UnauthorizedException("Authentication required.");
        }
        return user;
    }

    private static String handleFor(String email) {
        int at = email.indexOf('@');
        String local = at > 0 ? email.substring(0, at) : email;
        String cleaned = local.toLowerCase().replaceAll("[^a-z0-9]", "");
        return "@" + (cleaned.isEmpty() ? "user" : cleaned);
    }

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

    public record ClanRef(String id, String name, String tag, String color, String pictureUrl) {
    }

    public record Achievement(String icon, String title, String sub) {
    }

    /** Body for PUT /users/me/goal. */
    public static class GoalRequest {
        public Double weeklyGoalKm;
    }

    /** Body for POST /users/me/password. */
    public static class ChangePasswordRequest {
        public String currentPassword;
        public String newPassword;
    }

    /** Body for PUT /users/me/visibility. */
    public static class VisibilityRequest {
        public String visibility;
    }

    /** Body for PUT /users/me/theme. */
    public static class ThemeRequest {
        public String theme;
    }

    /** Profile response - hides passwordHash and other secrets. */
    public record MeResponse(
            String userId, String email, String fullName, int age, String birthDate, String role,
            boolean verified, String profileVisibility, String createdAt,
            String handle, String avatarColor, String pictureUrl, ClanRef clan,
            int volunteerEvents, boolean staffEligible, long volunteerPoints,
            double weeklyGoalKm, List<Achievement> achievements, String themePreference) {
    }
}
