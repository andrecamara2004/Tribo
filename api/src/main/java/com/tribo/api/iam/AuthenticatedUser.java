package com.tribo.api.iam;

/**
 * Represents the authenticated user attached to the current request.
 */
public record AuthenticatedUser(String userId, Role role) {
}