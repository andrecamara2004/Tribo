package com.tribo.api.iam;

import jakarta.ws.rs.core.SecurityContext;

import java.security.Principal;

/**
 * Custom SecurityContext attached to authenticated requests by JwtAuthFilter.
 *
 * Lets downstream code retrieve the authenticated user via
 *   @Context SecurityContext ctx;  ((JwtSecurityContext) ctx).user();
 *
 * isUserInRole() implements role checks for any future @RolesAllowed
 * integration, but we use @AllowedRoles + RolesDynamicFeature for our
 * own checks.
 */
public class JwtSecurityContext implements SecurityContext {

    private final AuthenticatedUser user;
    private final boolean secure;

    public JwtSecurityContext(AuthenticatedUser user, boolean secure) {
        this.user = user;
        this.secure = secure;
    }

    public AuthenticatedUser user() {
        return user;
    }

    @Override
    public Principal getUserPrincipal() {
        return user::userId;
    }

    @Override
    public boolean isUserInRole(String role) {
        return user != null && user.role() != null && user.role().name().equals(role);
    }

    @Override
    public boolean isSecure() {
        return secure;
    }

    @Override
    public String getAuthenticationScheme() {
        return "Bearer";
    }
}