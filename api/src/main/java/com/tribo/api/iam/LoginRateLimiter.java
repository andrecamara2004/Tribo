package com.tribo.api.iam;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks attempts per IP within a 1-minute window. If an IP exceeds
 * MAX_ATTEMPTS within that window, isRateLimited() returns true.
 */
public class LoginRateLimiter {

    private static final int MAX_ATTEMPTS = 10;
    private static final Duration WINDOW = Duration.ofMinutes(1);

    private static final ConcurrentHashMap<String, Deque<Instant>> ATTEMPTS = new ConcurrentHashMap<>();

    /**
     * Records an attempt from the given IP and checks whether the IP
     * is now over the limit.
     *
     * @param ip the client IP address (from X-Forwarded-For or RemoteAddr)
     * @return true if the IP should be blocked (too many recent attempts)
     */
    public static boolean isRateLimited(String ip) {
        Instant now = Instant.now();
        Instant cutoff = now.minus(WINDOW);

        ATTEMPTS.compute(ip, (k, deque) -> {
            if (deque == null)
                deque = new ArrayDeque<>();
            // Drop attempts outside the sliding window
            while (!deque.isEmpty() && deque.peekFirst().isBefore(cutoff)) {
                deque.pollFirst();
            }
            deque.addLast(now);
            return deque;
        });

        Deque<Instant> window = ATTEMPTS.get(ip);
        return window != null && window.size() > MAX_ATTEMPTS;
    }
}