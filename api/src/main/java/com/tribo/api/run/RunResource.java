package com.tribo.api.run;

import com.tribo.api.error.NotFoundException;
import com.tribo.api.error.UnauthorizedException;
import com.tribo.api.error.ValidationException;
import com.tribo.api.iam.AuthenticatedUser;
import com.tribo.api.iam.JwtAuthFilter;
import com.tribo.api.iam.User;
import com.tribo.api.iam.UserRepository;

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
import java.time.DateTimeException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Run logging + discovery endpoints
 */
@Path("/runs")
public class RunResource {

    private static final RunRepository RUNS = new RunRepository();
    private static final UserRepository USERS = new UserRepository();

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 100;


    //Log a run
    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response create(@Context ContainerRequestContext ctx, RunRequest req) {
        AuthenticatedUser caller = authUser(ctx);
        Run run = validate(req, caller.userId());
        RUNS.save(run);
        return Response.created(URI.create("/rest/runs/" + run.id()))
                .entity(run)
                .build();
    }


    //List
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Response list(@Context ContainerRequestContext ctx,
                         @QueryParam("scope") @DefaultValue("me") String scope,
                         @QueryParam("limit") @DefaultValue("50") int limitParam) {
        AuthenticatedUser caller = authUser(ctx);
        int limit = Math.max(1, Math.min(limitParam, MAX_LIMIT));

        List<Run> items;
        if ("clan".equalsIgnoreCase(scope)) {
            String clanId = USERS.findById(caller.userId()).map(User::clanId).orElse(null);
            if (clanId == null) {
                items = RUNS.listByOwner(caller.userId(), limit); // no clan → own runs
            } else {
                items = RUNS.listByOwners(USERS.findIdsByClan(clanId), limit);
            }
        } else {
            items = RUNS.listByOwner(caller.userId(), limit);
        }
        return Response.ok(Map.of("items", items)).build();
    }


    //Last run
    @GET
    @Path("/me/last")
    @Produces(MediaType.APPLICATION_JSON)
    public Response last(@Context ContainerRequestContext ctx) {
        AuthenticatedUser caller = authUser(ctx);
        Run run = RUNS.findLastByOwner(caller.userId())
                .orElseThrow(() -> new NotFoundException("You haven't logged any runs yet."));
        return Response.ok(run).build();
    }

    //Detail
    @GET
    @Path("/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response get(@PathParam("id") String id) {
        Run run = RUNS.findById(id)
                .orElseThrow(() -> new NotFoundException("No run with id " + id + "."));
        return Response.ok(run).build();
    }


    static AuthenticatedUser authUser(ContainerRequestContext ctx) {
        Object u = ctx.getProperty(JwtAuthFilter.USER_PROPERTY);
        if (!(u instanceof AuthenticatedUser user)) {
            throw new UnauthorizedException("Authentication required.");
        }
        return user;
    }

    private static Run validate(RunRequest req, String ownerId) {
        if (req == null) throw new ValidationException("Request body is required.");
        if (req.distanceMeters == null || req.distanceMeters <= 0) {
            throw new ValidationException("distanceMeters must be a positive integer.");
        }
        if (req.durationSeconds == null || req.durationSeconds <= 0) {
            throw new ValidationException("durationSeconds must be a positive integer.");
        }
        if (req.startedAt == null || req.startedAt.isBlank()) {
            throw new ValidationException("startedAt is required.");
        }
        Instant startedAt;
        try {
            startedAt = Instant.parse(req.startedAt.trim());
        } catch (DateTimeException e) {
            throw new ValidationException("startedAt must be an ISO-8601 instant, e.g. 2026-07-01T07:42:00Z.");
        }
        int elevation = req.elevationMeters == null ? 0 : Math.max(0, req.elevationMeters);
        String title = req.title == null || req.title.isBlank() ? "Run" : req.title.trim();
        String location = req.location == null ? "" : req.location.trim();
        String routeType = req.routeType == null || req.routeType.isBlank() ? "river" : req.routeType.trim();

        List<Run.Split> splits = new ArrayList<>();
        if (req.splits != null) {
            for (RunRequest.SplitInput s : req.splits) {
                if (s == null || s.km == null || s.durationSeconds == null
                        || s.km < 1 || s.durationSeconds <= 0) {
                    throw new ValidationException("Each split needs km ≥ 1 and durationSeconds > 0.");
                }
                splits.add(new Run.Split(s.km, s.durationSeconds));
            }
        }

        return new Run(
                UUID.randomUUID().toString(), ownerId, title, location,
                req.distanceMeters, req.durationSeconds, elevation, routeType,
                startedAt, Instant.now(), splits);
    }
}
