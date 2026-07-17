package com.tribo.api.iam;

/**
 * Decides whether a viewer may see another user's real identity. A PRIVATE
 * account is masked to everyone except the user themselves and privileged
 * roles (BACKOFFICE / SYSADMIN) — used wherever one user's name/picture is
 * shown to others (clan rosters, the activity feed).
 */
public final class ProfilePrivacy {

    public static boolean canSeeIdentity(AuthenticatedUser caller, User target) {
        return target.profileVisibility() != User.ProfileVisibility.PRIVATE
                || target.id().equals(caller.userId())
                || OwnershipGuard.isPrivileged(caller.role());
    }

    /** Placeholder name shown in place of a masked (PRIVATE) user. */
    public static final String MASKED_NAME = "Private user";

    private ProfilePrivacy() {
    }
}
