package com.tribo.api.iam;

import org.mindrot.jbcrypt.BCrypt;

/**
 * Password hashing wrapper using bcrypt.
 *
 * Cost factor 12: ~250ms per hash on typical hardware. Slow on purpose —
 * the slowness is what makes brute-forcing leaked hashes impractical.
 * Don't lower it for "performance." Login is supposed to take a quarter
 * of a second.
 *
 * Plaintext passwords MUST NEVER be stored, logged, or returned in API
 * responses. Use this class to hash before save and verify on login;
 * the plaintext should never travel further than the resource method
 * that receives it.
 */
public class PasswordHasher {

    private static final int COST = 12;

    /**
     * Produce a salted bcrypt hash. Salt is generated automatically and
     * embedded in the returned string (bcrypt's standard format).
     *
     * @return a string like "$2a$12$..." safe to store in Datastore
     */
    public static String hash(String plain) {
        return BCrypt.hashpw(plain, BCrypt.gensalt(COST));
    }

    /**
     * Constant-time comparison of a plaintext password against a stored hash.
     * Returns false on any error (malformed hash, null input, etc.) rather
     * than throwing — login should never reveal *why* verification failed.
     */
    public static boolean verify(String plain, String hash) {
        if (plain == null || hash == null || hash.isEmpty()) {
            return false;
        }
        try {
            return BCrypt.checkpw(plain, hash);
        } catch (IllegalArgumentException e) {
            // Malformed hash — treat as a failed verification.
            return false;
        }
    }

    private PasswordHasher() {
        // Utility class, no instances.
    }
}