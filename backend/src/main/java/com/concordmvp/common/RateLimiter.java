package com.concordmvp.common;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Two-window rate limiter for the endpoints that send email: a short window that stops
 * double-clicks and a long one that stops sustained abuse.
 *
 * In memory rather than Redis, per docs/DECISIONS.md D3. The state is lost on restart and is not
 * shared across instances; with a single instance the worst case is one extra email after a
 * restart, which beats adding infrastructure for it.
 */
public class RateLimiter {

    private final int shortLimit;
    private final Duration shortWindow;
    private final int longLimit;
    private final Duration longWindow;
    private final Map<String, Deque<Instant>> attempts = new ConcurrentHashMap<>();

    public RateLimiter(int shortLimit, Duration shortWindow, int longLimit, Duration longWindow) {
        this.shortLimit = shortLimit;
        this.shortWindow = shortWindow;
        this.longLimit = longLimit;
        this.longWindow = longWindow;
    }

    /**
     * Synchronized wholesale: ConcurrentHashMap protects the map, not the Deque inside it, and
     * the traffic here is far too low to justify anything finer.
     */
    public synchronized boolean tryAcquire(String key, Instant now) {
        Deque<Instant> timestamps = attempts.computeIfAbsent(key, k -> new ArrayDeque<>());

        timestamps.removeIf(timestamp -> timestamp.isBefore(now.minus(longWindow)));

        long recent = timestamps.stream()
                .filter(timestamp -> !timestamp.isBefore(now.minus(shortWindow)))
                .count();

        if (recent >= shortLimit || timestamps.size() >= longLimit) {
            return false;
        }

        timestamps.addLast(now);
        return true;
    }
}
