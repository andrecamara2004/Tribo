package com.tribo.api.error;

import jakarta.ws.rs.core.Response.Status;

import java.util.Map;

/**
 * 400 Bad Request. Use for malformed input — bad email format, weak password,
 * missing required field. Put per-field issues in details so clients can
 * highlight the right form input.
 *
 * Example details: { "email": "invalid format", "password": "too short" }
 */
public class ValidationException extends ApiException {

    public ValidationException(String message) {
        super("VALIDATION_ERROR", message, Status.BAD_REQUEST);
    }

    public ValidationException(String message, Map<String, Object> details) {
        super("VALIDATION_ERROR", message, Status.BAD_REQUEST, details);
    }
}