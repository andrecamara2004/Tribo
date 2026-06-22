package com.tribo.api.error;

import jakarta.ws.rs.core.Response.Status;

/**
 * Thrown when a client exceeds the allowed request rate on an endpoint.
 * Maps to HTTP 429 Too Many Requests.
 */
public class TooManyRequestsException extends ApiException {

    public TooManyRequestsException(String message) {
        super("TOO_MANY_REQUESTS", message, Status.TOO_MANY_REQUESTS);
    }
}
