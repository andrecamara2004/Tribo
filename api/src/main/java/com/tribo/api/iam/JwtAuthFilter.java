package com.tribo.api.iam;

import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.tribo.api.error.UnauthorizedException;

import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.ext.Provider;

import java.io.IOException;

/**
 * Validates JWT access tokens for every authenticated request.
 *
 * Behavior:
 *   - If the resource method or class is annotated @PublicEndpoint, skip.
 *   - Otherwise, require Authorization: Bearer <token>.
 *   - Verify the token (signature, expiry, issuer) via JwtIssuer.
 *   - Reject refresh tokens (typ=refresh) — only access tokens are valid here.
 *   - On success, attach a JwtSecurityContext exposing the user id and role.
 *   - On failure, throw UnauthorizedException — ApiExceptionMapper turns it
 *     into a 401 with the standard error envelope.
 *
 * NOT @PreMatching so it has access to the matched resource method's
 * annotations (needed for @PublicEndpoint check via name binding).
 *
 * Priority AUTHENTICATION puts it before any custom request filters.
 */
@Provider
@Priority(Priorities.AUTHENTICATION)
public class JwtAuthFilter implements ContainerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final JwtIssuer JWT = new JwtIssuer();

    @jakarta.ws.rs.core.Context
    jakarta.ws.rs.container.ResourceInfo resourceInfo;

    @Override
    public void filter(ContainerRequestContext ctx) throws IOException {
        if (isPublic()) {
            return;
        }

        String header = ctx.getHeaderString("Authorization");
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            throw new UnauthorizedException("Missing or malformed Authorization header.");
        }

        String token = header.substring(BEARER_PREFIX.length()).trim();

        DecodedJWT decoded;
        try {
            decoded = JWT.verify(token);
        } catch (JWTVerificationException e) {
            throw new UnauthorizedException("Token invalid or expired.");
        }

        // Reject refresh tokens used as access tokens.
        String typ = decoded.getClaim("typ").asString();
        if ("refresh".equals(typ)) {
            throw new UnauthorizedException("Refresh tokens cannot be used as access tokens.");
        }

        String userId = decoded.getSubject();
        String roleName = decoded.getClaim("role").asString();
        if (userId == null || roleName == null) {
            throw new UnauthorizedException("Token missing required claims.");
        }

        Role role;
        try {
            role = Role.valueOf(roleName);
        } catch (IllegalArgumentException e) {
            throw new UnauthorizedException("Token has unknown role.");
        }

        ctx.setSecurityContext(new JwtSecurityContext(
                new AuthenticatedUser(userId, role),
                ctx.getSecurityContext().isSecure()));
    }

    private boolean isPublic() {
        if (resourceInfo == null) return false;

        var method = resourceInfo.getResourceMethod();
        var klass = resourceInfo.getResourceClass();

        if (method != null && method.isAnnotationPresent(PublicEndpoint.class)) return true;
        if (klass != null && klass.isAnnotationPresent(PublicEndpoint.class)) return true;

        return false;
    }
}