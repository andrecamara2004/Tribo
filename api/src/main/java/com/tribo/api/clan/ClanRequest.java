package com.tribo.api.clan;

/**
 * Request body for creating a clan.
 *
 * Mutable POJO for Jackson (same rationale as ActivityRequest). `ownerId` and
 * `createdAt` are NEVER taken from the client — they're server-controlled.
 */
public class ClanRequest {
    public String name;
    public String tag;   // short uppercase label, 2–5 chars
    public String color; // hex "#RRGGBB"
}
