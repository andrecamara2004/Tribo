package com.tribo.api.activity;

/**
 * Whether an activity is a plain run/event or a volunteer event with staff +
 * participant roles, points, and a verification badge (D-6).
 *
 * Stored as the enum name string. Legacy entities (created before this field)
 * default to RUN on read. Adding a kind is safe; renaming/removing is breaking.
 */
public enum EventKind {
    RUN,
    VOLUNTEER
}
