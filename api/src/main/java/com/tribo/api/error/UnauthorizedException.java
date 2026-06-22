package com.tribo.api.error;

import jakarta.ws.rs.core.Response.Status;

/**
 * 401 Unauthorized. Use when the token is missing, expired, malformed, or
 * for the login endpoint when credentials don't match.
 *
 * Same error returned for wrong-email and wrong-password to prevent
 * account enumeration.
 */
public class UnauthorizedException extends ApiException {

    public UnauthorizedException(String message) {
        super("INVALID_TOKEN", message, Status.UNAUTHORIZED);
    }

    public UnauthorizedException(String code, String message) {
        super(code, message, Status.UNAUTHORIZED);
    }
}