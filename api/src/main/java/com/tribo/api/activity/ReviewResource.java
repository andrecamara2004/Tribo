package com.tribo.api.activity;

import com.tribo.api.error.ForbiddenException;
import com.tribo.api.error.NotFoundException;
import com.tribo.api.error.ValidationException;
import com.tribo.api.iam.AuthenticatedUser;
import com.tribo.api.iam.User;
import com.tribo.api.iam.UserRepository;

import jakarta.ws.rs.Consumes;
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
import java.util.Map;
import java.util.List;

@Path("/activities/{id}/reviews")
public class ReviewResource {

        private static final ReviewRepository REVIEWS = new ReviewRepository();
        private static final ActivityRepository ACTIVITIES = new ActivityRepository();
        private static final ParticipationRepository PARTICIPANTS = new ParticipationRepository();
        private static final UserRepository USERS = new UserRepository();

        @GET
        @Produces(MediaType.APPLICATION_JSON)
        public Response list(
                        @Context ContainerRequestContext ctx,
                        @PathParam("id") String activityId) {

                ActivityResource.authUser(ctx);

                Activity activity = ACTIVITIES.findById(activityId)
                                .orElseThrow(() -> new NotFoundException("No activity with id " + activityId + "."));

                List<ReviewView> reviews = REVIEWS.listByActivity(activityId)
                                .stream()
                                .map(r -> {
                                        String userName = USERS.findById(r.userId())
                                                        .map(User::displayName) // <-- we'll adjust this if your User
                                                                                // record
                                                                                // uses another field
                                                        .orElse("Unknown user");

                                        return new ReviewView(
                                                        r.id(),
                                                        r.activityId(),
                                                        r.userId(),
                                                        userName,
                                                        r.rating(),
                                                        r.comment(),
                                                        r.createdAt());
                                })
                                .toList();

                return Response.ok(Map.of(
                                "activityId", activity.id(),
                                "averageRating", activity.averageRating(),
                                "reviewCount", activity.reviewCount(),
                                "reviews", reviews))
                                .build();
        }

        // Create Review
        @POST
        @Consumes(MediaType.APPLICATION_JSON)
        @Produces(MediaType.APPLICATION_JSON)
        public Response review(
                        @Context ContainerRequestContext ctx,
                        @PathParam("id") String activityId,
                        ReviewRequest req) {

                AuthenticatedUser caller = ActivityResource.authUser(ctx);

                Activity activity = ACTIVITIES.findById(activityId)
                                .orElseThrow(() -> new NotFoundException("No activity with id " + activityId + "."));

                if (activity.endsAt().isAfter(Instant.now())) {
                        throw new ValidationException(
                                        "You can only review an activity after it has ended.");
                }

                if (!PARTICIPANTS.exists(activityId, caller.userId())) {
                        throw new ForbiddenException(
                                        "You must participate before reviewing this activity.");
                }

                if (req == null || req.rating == null
                                || req.rating < 1 || req.rating > 5) {
                        throw new ValidationException(
                                        "Rating must be between 1 and 5.");
                }

                String comment = req.comment == null ? "" : req.comment.trim();

                ReviewView review = new ReviewView(
                                activityId + "::" + caller.userId(),
                                activityId,
                                caller.userId(),
                                USERS.findById(caller.userId())
                                                .map(User::displayName)
                                                .orElse("Unknown user"),
                                req.rating,
                                comment,
                                Instant.now());

                REVIEWS.save(review);

                updateActivityRating(activity);

                return Response.ok(review).build();
        }

        private void updateActivityRating(Activity activity) {

                int reviewCount = REVIEWS.countByActivity(activity.id());
                double average = REVIEWS.averageRating(activity.id());

                Activity updated = new Activity(
                                activity.id(),
                                activity.ownerId(),
                                activity.title(),
                                activity.description(),
                                activity.category(),
                                activity.location(),
                                activity.startsAt(),
                                activity.endsAt(),
                                activity.capacity(),
                                activity.status(),
                                activity.createdAt(),
                                Instant.now(),

                                activity.eventKind(),
                                activity.host(),
                                activity.distanceKm(),
                                activity.verifiedBy(),
                                activity.staffCapacity(),
                                activity.pointsParticipant(),
                                activity.pointsStaff(),
                                activity.tags(),
                                activity.latitude(),
                                activity.longitude(),

                                reviewCount,
                                average);

                ACTIVITIES.save(updated);
        }
}