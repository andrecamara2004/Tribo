package com.tribo.api.iam;

/**
 * Deterministic cosmetic avatar colour from a user id. Shared so a user's colour
 * is identical everywhere it appears (profile, feed authors, …). Purely visual —
 * never encodes real data.
 */
public final class AvatarColor {

    private static final String[] PALETTE =
            {"#00B86B", "#1B8A5A", "#3A7BD5", "#FFB020", "#D5398B", "#7B5BD9"};

    private AvatarColor() {}

    public static String forId(String id) {
        int hash = 0;
        for (int i = 0; i < id.length(); i++) hash = hash * 31 + id.charAt(i);
        return PALETTE[Math.floorMod(hash, PALETTE.length)];
    }
}
