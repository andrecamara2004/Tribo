package com.tribo.api.activity;

/**
 * How a volunteer event's attendance is vouched for — a display badge, not a
 * per-user attendance record.
 *
 *   PEER    — confirmed on-site by elected event staff (default).
 *   PARTNER — run by an NGO / municipality partner.
 *
 * Stored as the enum name string; legacy entities default to PEER on read.
 */
public enum VerifiedBy {
    PEER,
    PARTNER
}
