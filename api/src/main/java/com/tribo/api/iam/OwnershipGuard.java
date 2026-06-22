package com.tribo.api.iam;

import com.tribo.api.error.ForbiddenException;

import java.util.EnumSet;
import java.util.Set;

/**
 * Authorization primitive for owner-scoped resources (B2-2).
 *
 * `@AllowedRoles` answers "may this *kind* of user call this endpoint?" — it
 * can't express "...but only for the rows they own." Editing or cancelling an
 * activity needs that finer check: the owner, OR a privileged role acting in an
 * administrative capacity (BACKOFFICE / SYSADMIN).
 *
 * Kept as an explicit helper called inside resource methods rather than an
 * annotation framework — the target's ownerId isn't known until the entity is
 * loaded, so the check is inherently inside the method. If a third resource
 * needs this we can revisit an abstraction; for now, explicit and testable.
 */
public final class OwnershipGuard {

    /** Roles that may act on any resource regardless of ownership. */
    private static final Set<Role> PRIVILEGED = EnumSet.of(Role.BACKOFFICE, Role.SYSADMIN);

    private OwnershipGuard() {
    }

    public static boolean isPrivileged(Role role) {
        return PRIVILEGED.contains(role);
    }

    /**
     * Allow the caller through only if they own the resource or hold a
     * privileged role. Throws ForbiddenException (→ 403) otherwise.
     *
     * @param user    the authenticated caller (from JwtAuthFilter)
     * @param ownerId the resource's owner id
     */
    public static void requireOwnerOrPrivileged(AuthenticatedUser user, String ownerId) {
        if (user == null) {
            throw new ForbiddenException("Authentication required.");
        }
        if (user.userId().equals(ownerId) || isPrivileged(user.role())) {
            return;
        }
        throw new ForbiddenException("You do not have permission to modify this resource.");
    }
}
