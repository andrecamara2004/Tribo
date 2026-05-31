package com.tribo.api.error;

import jakarta.ws.rs.core.Response.Status;

/**
 * 404 Not Found. Resource doesn't exist (or the caller doesn't have
 * permission to know it exists — use 404 instead of 403 when leaking
 * existence would be a privacy issue).
 */
public class NotFoundException extends ApiException {

    public NotFoundException(String message) {
        super("NOT_FOUND", message, Status.NOT_FOUND);
    }
}