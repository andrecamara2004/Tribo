package com.tribo.api.activity;

import java.util.Optional;

/**
 * Volunteer standing derived from a user's participations (D-6). Shared by the
 * join-as-staff eligibility check (ParticipationResource) and the profile read
 * (GET /users/me), so the rule lives in exactly one place.
 *
 * "Staff-eligible" means the user has joined at least {@link #STAFF_THRESHOLD}
 * VOLUNTEER-kind activities. Computed on the fly (no stored counter).
 */
public final class VolunteerStats {

    public static final int STAFF_THRESHOLD = 3;

    private static final ParticipationRepository PARTICIPANTS = new ParticipationRepository();
    private static final ActivityRepository ACTIVITIES = new ActivityRepository();

    private VolunteerStats() {}

    /** A user's volunteer standing, computed in a single scan of their joins. */
    public record Summary(int events, int staffEvents, long points) {
        public boolean staffEligible() {
            return events >= STAFF_THRESHOLD;
        }
    }

    public static Summary summary(String userId) {
        int events = 0;
        int staffEvents = 0;
        long points = 0;
        for (Participation p : PARTICIPANTS.findByUser(userId)) {
            Optional<Activity> found = ACTIVITIES.findById(p.activityId());
            if (found.isEmpty() || found.get().eventKind() != EventKind.VOLUNTEER) continue;
            Activity a = found.get();
            events++;
            if (p.role() == ParticipationRole.STAFF) {
                staffEvents++;
                points += a.pointsStaff();
            } else {
                points += a.pointsParticipant();
            }
        }
        return new Summary(events, staffEvents, points);
    }

    /** Number of VOLUNTEER-kind activities the user has joined (any role). */
    public static int volunteerEventCount(String userId) {
        return summary(userId).events();
    }

    public static boolean isStaffEligible(String userId) {
        return volunteerEventCount(userId) >= STAFF_THRESHOLD;
    }
}
