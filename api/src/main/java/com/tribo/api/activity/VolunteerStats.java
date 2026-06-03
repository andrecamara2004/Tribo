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

    /** Number of VOLUNTEER-kind activities the user has joined (any role). */
    public static int volunteerEventCount(String userId) {
        int count = 0;
        for (Participation p : PARTICIPANTS.findByUser(userId)) {
            Optional<Activity> a = ACTIVITIES.findById(p.activityId());
            if (a.isPresent() && a.get().eventKind() == EventKind.VOLUNTEER) count++;
        }
        return count;
    }

    public static boolean isStaffEligible(String userId) {
        return volunteerEventCount(userId) >= STAFF_THRESHOLD;
    }
}
