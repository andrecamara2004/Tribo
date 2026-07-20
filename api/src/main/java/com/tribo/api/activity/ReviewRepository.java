package com.tribo.api.activity;

import com.tribo.api.iam.User;
import com.tribo.api.iam.UserRepository;

import com.google.cloud.datastore.Datastore;
import com.google.cloud.datastore.DatastoreOptions;
import com.google.cloud.datastore.Entity;
import com.google.cloud.datastore.Key;
import com.google.cloud.datastore.KeyFactory;
import com.google.cloud.datastore.Query;
import com.google.cloud.datastore.QueryResults;
import com.google.cloud.datastore.StructuredQuery.PropertyFilter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

public class ReviewRepository {

    static final String KIND = "Review";

    private static final Datastore DATASTORE = DatastoreOptions.getDefaultInstance().getService();

    private static final KeyFactory KEY_FACTORY = DATASTORE.newKeyFactory().setKind(KIND);

    private static final UserRepository USERS = new UserRepository();

    private static String keyOf(String activityId, String userId) {
        return activityId + "::" + userId;
    }

    public void save(ReviewView review) {

        Key key = KEY_FACTORY.newKey(keyOf(review.activityId(), review.userId()));

        Entity entity = Entity.newBuilder(key)
                .set("activityId", review.activityId())
                .set("userId", review.userId())
                .set("rating", review.rating())
                .set("comment", review.comment())
                .set("createdAt", review.createdAt().toString())
                .build();

        DATASTORE.put(entity);
    }

    public Optional<ReviewView> find(String activityId, String userId) {

        Entity entity = DATASTORE.get(
                KEY_FACTORY.newKey(keyOf(activityId, userId)));

        return Optional.ofNullable(entity)
                .map(this::toReview);
    }

    public void delete(String activityId, String userId) {

        DATASTORE.delete(
                KEY_FACTORY.newKey(keyOf(activityId, userId)));
    }

    public List<ReviewView> listByActivity(String activityId) {

        Query<Entity> query = Query.newEntityQueryBuilder()
                .setKind(KIND)
                .setFilter(PropertyFilter.eq("activityId", activityId))
                .build();

        QueryResults<Entity> results = DATASTORE.run(query);

        List<ReviewView> reviews = new ArrayList<>();

        while (results.hasNext()) {
            reviews.add(toReview(results.next()));
        }

        reviews.sort(
                Comparator.comparing(ReviewView::createdAt).reversed());

        return reviews;
    }

    public int countByActivity(String activityId) {

        Query<Key> query = Query.newKeyQueryBuilder()
                .setKind(KIND)
                .setFilter(PropertyFilter.eq("activityId", activityId))
                .build();

        QueryResults<Key> results = DATASTORE.run(query);

        int count = 0;

        while (results.hasNext()) {
            results.next();
            count++;
        }

        return count;
    }

    public double averageRating(String activityId) {

        List<ReviewView> reviews = listByActivity(activityId);

        if (reviews.isEmpty()) {
            return 0.0;
        }

        double sum = 0;

        for (ReviewView review : reviews) {
            sum += review.rating();
        }

        return sum / reviews.size();
    }

    private ReviewView toReview(Entity entity) {

        String userId = entity.getString("userId");

        User user = USERS.findById(userId)
                .orElse(null);

        String userName = user != null
                ? user.displayName()
                : "Unknown user";

        return new ReviewView(
                entity.getKey().getName(),
                entity.getString("activityId"),
                userId,
                userName,
                (int) entity.getLong("rating"),
                entity.getString("comment"),
                Instant.parse(entity.getString("createdAt")));
    }
}