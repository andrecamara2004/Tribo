package com.tribo.api.activity;

/**
 * A participant's role on a volunteer event (D-6).
 *
 *   PARTICIPANT — a runner attendee (default; the only role on plain events).
 *   STAFF       — helps run the event; earns the staff points bonus. Requires
 *                 staff eligibility (≥ 3 volunteer events joined).
 *
 * Stored as the enum name string; legacy participations default to PARTICIPANT.
 */
public enum ParticipationRole {
    PARTICIPANT,
    STAFF
}
