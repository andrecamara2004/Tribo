package com.tribo.api.activity;

/**
 * Lifecycle state of an activity.
 *
 *   DRAFT            — created, owner still editing; not shown in the public catalog.
 *   PENDING_APPROVAL — submitted by a manager/partner, awaiting backoffice review;
 *                      not shown in discovery and not joinable.
 *   PUBLISHED        — approved (or admin-created); visible in discovery; users may join.
 *   REJECTED         — backoffice declined the submission; not public.
 *   CANCELLED        — called off by the owner; kept (soft state) so participation
 *                      history survives. No new joins.
 *
 * Stored as the enum name string in Datastore. Adding a state is safe;
 * renaming/removing one is a breaking change for existing entities.
 */
public enum ActivityStatus {
    DRAFT,
    PENDING_APPROVAL,
    PUBLISHED,
    REJECTED,
    CANCELLED
}
