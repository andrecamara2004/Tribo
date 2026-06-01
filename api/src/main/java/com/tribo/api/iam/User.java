package com.tribo.api.iam;

import java.time.Instant;

/**
 * Domain model for a registered user.
 *
 * Immutable Java record — easy to construct, safe to share, naturally
 * serialized to JSON by Jackson (which is wired into Jersey via JacksonFeature
 * in web.xml).
 *
 * Note: the password hash is included on the domain object but MUST NEVER
 * appear in API responses. Resource methods should map User to a separate
 * "UserResponse" DTO that omits passwordHash before returning it. (We'll
 * add that DTO when we wire the /auth/register endpoint in ticket B-6.)
 *
 * The Datastore "kind" name and the field-to-property mapping live in
 * UserRepository, not on the record itself, so the domain class stays
 * pure Java.
 */
public record User(
        String id,                  // UUID string, also used as the entity key
        String email,               // always stored lowercased
        String passwordHash,        // bcrypt hash (B-2)
        String fullName,
        String phoneNumber,         // E.164 format e.g. "+351912345678"
        int age,
        Role role,
        ProfileVisibility profileVisibility,
        Instant createdAt,
        boolean suspended,          // backoffice can flip this; login should reject if true
        boolean verified            // privileged self-registered roles start false; backoffice verifies (D-1)
) {
    public enum ProfileVisibility {
        PUBLIC,
        PRIVATE
    }
}