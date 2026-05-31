package com.tribo.api.error;

import jakarta.ws.rs.core.Response.Status;

/**
 * 403 Forbidden. Token is valid but the user's role doesn't include
 * permission for this operation.
 */
public class ForbiddenException extends ApiException {

    public ForbiddenException(String message) {
        super("FORBIDDEN", message, Status.FORBIDDEN);
    }
}