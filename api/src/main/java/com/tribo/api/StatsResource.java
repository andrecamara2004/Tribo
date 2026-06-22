package com.tribo.api;

import com.tribo.api.activity.ActivityRepository;
import com.tribo.api.iam.AllowedRoles;
import com.tribo.api.iam.Role;
import com.tribo.api.iam.UserRepository;
import com.tribo.api.run.RunRepository;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;

/**
 * Platform statistics for BACKOFFICE/SYSADMIN.
 *
 * GET /rest/admin/stats — aggregate counts across all data kinds.
 *
 * B4-2: provides basic platform health numbers so backoffice staff
 * can monitor platform growth without direct Datastore access.
 */
@Path("/admin/stats")
public class StatsResource {

    private static final UserRepository USERS = new UserRepository();
    private static final ActivityRepository ACTIVITIES = new ActivityRepository();
    private static final RunRepository RUNS = new RunRepository();

    /**
     * Returns aggregate counts for the platform.
     * Uses keys-only queries where possible for efficiency.
     */
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @AllowedRoles({ Role.BACKOFFICE, Role.SYSADMIN })
    public Response stats() {
        long totalUsers = USERS.countAll();
        long totalActivities = ACTIVITIES.countAll();
        long volunteerEvents = ACTIVITIES.countByKind("VOLUNTEER");
        long totalRuns = RUNS.all().size(); // full scan; acceptable at this scale

        return Response.ok(Map.of(
                "totalUsers", totalUsers,
                "totalActivities", totalActivities,
                "volunteerEvents", volunteerEvents,
                "totalRuns", totalRuns)).build();
    }
}