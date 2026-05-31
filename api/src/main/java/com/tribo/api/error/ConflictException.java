package com.tribo.api.error;

import jakarta.ws.rs.core.Response.Status;

/**
 * 409 Conflict. Duplicate resource — e.g. email already registered.
 */
public class ConflictException extends ApiException {

    public ConflictException(String message) {
        super("ALREADY_EXISTS", message, Status.CONFLICT);
    }
}