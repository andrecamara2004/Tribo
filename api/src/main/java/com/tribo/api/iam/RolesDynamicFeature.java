package com.tribo.api.iam;

import com.tribo.api.error.ForbiddenException;
import com.tribo.api.error.UnauthorizedException;

import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.DynamicFeature;
import jakarta.ws.rs.container.ResourceInfo;
import jakarta.ws.rs.core.FeatureContext;
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
 * The role filter reads the AuthenticatedUser from the "tribo.user" request
 * property set by JwtAuthFilter, rather than casting the SecurityContext.
 * It is registered with @Priority(AUTHORIZATION) so it provably runs after
 * JwtAuthFilter (AUTHENTICATION = 1000 < AUTHORIZATION = 2000); by the time
 * it runs, the property is populated.
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

    @Priority(Priorities.AUTHORIZATION)
    private record RoleCheckFilter(Set<Role> allowed) implements ContainerRequestFilter {
        @Override
        public void filter(ContainerRequestContext ctx) throws IOException {
            Object u = ctx.getProperty(JwtAuthFilter.USER_PROPERTY);
            if (!(u instanceof AuthenticatedUser user)) {
                throw new UnauthorizedException("Authentication required.");
            }
            if (!allowed.contains(user.role())) {
                throw new ForbiddenException("Your role is not permitted to perform this action.");
            }
        }
    }
}