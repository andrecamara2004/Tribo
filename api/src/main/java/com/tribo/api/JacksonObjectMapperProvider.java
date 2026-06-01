package com.tribo.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import jakarta.ws.rs.ext.ContextResolver;
import jakarta.ws.rs.ext.Provider;

/**
 * Supplies the ObjectMapper Jersey/Jackson uses for (de)serialization.
 *
 * Why this exists: the default mapper has no java.time support, so serializing
 * an entity with an Instant field (e.g. Activity.startsAt) fails with
 * "Java 8 date/time type java.time.Instant not supported by default". We register
 * the JavaTimeModule and disable WRITE_DATES_AS_TIMESTAMPS so Instants serialize
 * as ISO-8601 strings (e.g. "2027-07-01T18:00:00Z") — matching the API contract
 * and what the web/mobile clients parse.
 *
 * Auto-discovered via the @Provider package scan in web.xml.
 */
@Provider
public class JacksonObjectMapperProvider implements ContextResolver<ObjectMapper> {

    private final ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Override
    public ObjectMapper getContext(Class<?> type) {
        return mapper;
    }
}
