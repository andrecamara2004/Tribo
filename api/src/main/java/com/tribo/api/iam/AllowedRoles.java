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
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface AllowedRoles {
    Role[] value();
}