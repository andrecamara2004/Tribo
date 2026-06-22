package com.tribo.api.error;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Translates exceptions thrown from resource methods into the standard
 * error envelope from the API contract:
 *
 *   { "error": { "code": "...", "message": "...", "details": {...} } }
 *
 * Two behaviors:
 *   - ApiException subclasses → use their declared code/status/details
 *   - Anything else → log server-side, return generic 500 INTERNAL_ERROR
 *     with a non-revealing message (no stack traces leaked to clients)
 *
 * @Provider makes Jersey auto-discover this class via the package scan
 * configured in web.xml.
 */
@Provider
public class ApiExceptionMapper implements ExceptionMapper<Throwable> {

    private static final Logger LOG = Logger.getLogger(ApiExceptionMapper.class.getName());

    @Override
    public Response toResponse(Throwable t) {
        if (t instanceof ApiException ex) {
            return Response.status(ex.getStatus())
                    .type(MediaType.APPLICATION_JSON)
                    .entity(envelope(ex.getCode(), ex.getMessage(), ex.getDetails()))
                    .build();
        }

        // Unexpected: log full stack trace, return generic 500.
        LOG.log(Level.SEVERE, "Unhandled exception in resource method", t);

        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .type(MediaType.APPLICATION_JSON)
                .entity(envelope(
                        "INTERNAL_ERROR",
                        "An unexpected error occurred.",
                        Map.of()))
                .build();
    }

    private static Map<String, Object> envelope(String code, String message, Map<String, Object> details) {
        // LinkedHashMap so JSON output order is stable: code, message, details.
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", code);
        error.put("message", message);
        error.put("details", details);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", error);
        return body;
    }
}