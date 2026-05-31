package com.tribo.api.iam;

/**
 * Represents the authenticated user attached to the current request.
 * Populated by JwtAuthFilter from the validated JWT and read back by
 * resource methods via the SecurityContext.
 */
public record AuthenticatedUser(String userId, Role role) {
}