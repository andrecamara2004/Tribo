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
        String id, // UUID string, also used as the entity key
        String email, // always stored lowercased
        String passwordHash, // bcrypt hash (B-2)
        String fullName,
        String phoneNumber, // E.164 format e.g. "+351912345678"
        String birthDate, // ISO date "YYYY-MM-DD"; age is derived from it
        Role role,
        ProfileVisibility profileVisibility,
        Instant createdAt,
        boolean suspended, // backoffice can flip this; login should reject if true
        boolean verified, // privileged self-registered roles start false; backoffice verifies (D-1)
        String clanId, // the clan the user belongs to, or null if none (D-3)
        double weeklyGoalKm, // per-user weekly distance goal; 0 = none (Phase 6)
        String pictureUrl, // public URL of the user's profile picture, or null
        boolean emailVerified, // true once the user confirms their email (login gate)
        ThemePreference themePreference) {
    /** Age in whole years derived from {@link #birthDate}, or 0 if unknown. */
    public int age() {
        if (birthDate == null || birthDate.isBlank()) {
            return 0;
        }
        try {
            return (int) java.time.temporal.ChronoUnit.YEARS.between(
                    java.time.LocalDate.parse(birthDate),
                    java.time.LocalDate.now(java.time.ZoneOffset.UTC));
        } catch (Exception e) {
            return 0;
        }
    }

    public enum ProfileVisibility {
        PUBLIC, PRIVATE
    }

    public enum ThemePreference {
        LIGHT, DARK
    }
}