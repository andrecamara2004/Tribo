package com.tribo.api.iam;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Restricts an endpoint to one or more roles.
 *
 * Example:
 *   @AllowedRoles({Role.ACTIVITY_MANAGER, Role.PARTNER})
 *   @POST @Path("/activities")
 *   public Response createActivity(...) { ... }
 *
 * Enforced by RolesDynamicFeature, which adds a per-method filter that
 * throws ForbiddenException if the caller's role is not in the list.
 *
 * If the annotation is absent, any authenticated user can call the endpoint.
 * Use @PublicEndpoint to allow unauthenticated calls.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface AllowedRoles {
    Role[] value();
}