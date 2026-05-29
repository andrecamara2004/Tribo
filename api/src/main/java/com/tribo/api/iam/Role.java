package com.tribo.api.iam;
 
/**
 * RBAC roles per the API contract. Stored as strings in Datastore (the enum name)
 * and emitted as such in JWT claims.
 *
 * Adding a new role here is safe; renaming or removing one is a breaking change
 * because existing User entities and existing JWTs reference role names.
 */
public enum Role {
    END_USER,
    ACTIVITY_MANAGER,
    PARTNER,
    BACKOFFICE,
    SYSADMIN
}
 