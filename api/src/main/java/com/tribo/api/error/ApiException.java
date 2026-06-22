package com.tribo.api.error;

import jakarta.ws.rs.core.Response.Status;

import java.util.Map;

/**
 * Base class for all expected API errors. Throw a subclass from a resource
 * method and the ApiExceptionMapper converts it to a JSON envelope matching
 * the API contract.
 *
 * Per the contract, every error response looks like:
 *   { "error": { "code": "...", "message": "...", "details": { ... } } }
 *
 * Clients switch on `code` (stable, machine-readable) and may display
 * `message` (human-readable English).
 */
public class ApiException extends RuntimeException {

    private final String code;
    private final Status status;
    private final Map<String, Object> details;

    public ApiException(String code, String message, Status status) {
        this(code, message, status, Map.of());
    }

    public ApiException(String code, String message, Status status, Map<String, Object> details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details == null ? Map.of() : details;
    }

    public String getCode() {
        return code;
    }

    public Status getStatus() {
        return status;
    }

    public Map<String, Object> getDetails() {
        return details;
    }
}