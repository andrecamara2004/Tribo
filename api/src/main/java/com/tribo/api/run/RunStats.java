package com.tribo.api.run;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Derived running statistics for a user
 *
 *   weeklyKm        - km per day for the current week, Monday to Sunday (index 0 = Mon)
 *   monthKm         - total km in the current calendar month
 *   monthRuns       - number of runs in the current calendar month
 *   avgPaceSecPerKm - all-time average pace (seconds per km), or null if no runs
 *   streak          - consecutive days with >=1 run, ending today or yesterday
 */
public record RunStats(
        double[] weeklyKm,
        double monthKm,
        int monthRun-s,
        Integer avgPaceSecPerKm,
        int streak
) {
    public static RunStats from(List<Run> runs, Instant now) {
        LocalDate today = now.atZone(ZoneOffset.UTC).toLocalDate();
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate sunday = monday.plusDays(6);

        double[] weekly = new double[7];
        double monthKm = 0;
        int monthRuns = 0;
        long totalMeters = 0;
        long totalSeconds = 0;
        Set<LocalDate> runDays = new HashSet<>();

        for (Run r : runs) {
            LocalDate day = r.startedAt().atZone(ZoneOffset.UTC).toLocalDate();
            double km = r.distanceMeters() / 1000.0;
            runDays.add(day);
            totalMeters += r.distanceMeters();
            totalSeconds += r.durationSeconds();

            if (!day.isBefore(monday) && !day.isAfter(sunday)) {
                weekly[day.getDayOfWeek().getValue() - 1] += km; // Mon=1 → index 0
            }
            if (day.getYear() == today.getYear() && day.getMonthValue() == today.getMonthValue()) {
                monthKm += km;
                monthRuns++;
            }
        }

        Integer avgPace = null;
        if (totalMeters > 0) {
            avgPace = (int) Math.round(totalSeconds / (totalMeters / 1000.0));
        }

        // Current streak: count back from today (or yesterday) while each day ran.
        int streak = 0;
        LocalDate cursor = today;
        if (!runDays.contains(cursor)) {
            cursor = cursor.minusDays(1);
        }
        while (runDays.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }

        // Round weekly/month km to 1 decimal for a clean wire value.
        for (int i = 0; i < weekly.length; i++) weekly[i] = round1(weekly[i]);
        return new RunStats(weekly, round1(monthKm), monthRuns, avgPace, streak);
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
