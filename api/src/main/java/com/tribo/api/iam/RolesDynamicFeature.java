package com.tribo.api.iam;

import com.tribo.api.error.ForbiddenException;
import com.tribo.api.error.UnauthorizedException;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.DynamicFeature;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.FeatureContext;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.ext.Provider;

import java.io.IOException;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Scans every resource method at startup; for methods annotated
 * @AllowedRoles, registers a per-method request filter that enforces the
 * role check after authentication.
 *
 * Runs after JwtAuthFilter (which has higher priority via AUTHENTICATION),
 * so by the time the role filter runs, the SecurityContext is already
 * populated with the authenticated user.
 */
@Provider
public class RolesDynamicFeature implements DynamicFeature {

    @Override
    public void configure(ResourceInfo resourceInfo, FeatureContext context) {
        AllowedRoles methodAnnotation = resourceInfo.getResourceMethod().getAnnotation(AllowedRoles.class);
        AllowedRoles classAnnotation = resourceInfo.getResourceClass().getAnnotation(AllowedRoles.class);

        AllowedRoles effective = methodAnnotation != null ? methodAnnotation : classAnnotation;
        if (effective == null) return;

        Set<Role> allowed = Arrays.stream(effective.value()).collect(Collectors.toSet());
        context.register(new RoleCheckFilter(allowed));
    }

    private record RoleCheckFilter(Set<Role> allowed) implements ContainerRequestFilter {
        @Override
        public void filter(ContainerRequestContext ctx) throws IOException {
            SecurityContext sec = ctx.getSecurityContext();
            if (!(sec instanceof JwtSecurityContext jwtCtx)) {
                throw new UnauthorizedException("Authentication required.");
            }
            Role userRole = jwtCtx.user().role();
            if (!allowed.contains(userRole)) {
                throw new ForbiddenException("Your role is not permitted to perform this action.");
            }
        }
    }
}