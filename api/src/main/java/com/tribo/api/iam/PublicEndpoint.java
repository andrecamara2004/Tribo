package com.tribo.api.iam;

import jakarta.ws.rs.NameBinding;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marker for endpoints that don't require authentication.
 *
 * Applied to register, login, refresh, logout, and the health probe.
 * Everything else requires a valid access token by default.
 *
 * The @NameBinding makes Jersey treat this as a filter-targeting annotation —
 * JwtAuthFilter's matching logic checks for it to decide whether to enforce
 * the Authorization header.
 */
@NameBinding
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
public @interface PublicEndpoint {
}