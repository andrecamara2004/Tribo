package com.tribo.api.activity;

import java.util.List;

/**
 * One page of activity results plus an opaque cursor for the next page.
 * `nextCursor` is null when there are no more results. Clients pass it back
 * as the `cursor` query param to continue.
 */
public record ActivityPage(List<Activity> items, String nextCursor) {
}
