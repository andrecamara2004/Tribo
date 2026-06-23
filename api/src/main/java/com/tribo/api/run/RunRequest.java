package com.tribo.api.run;

import java.util.List;

/**
 * Request body for logging a run (POST /runs).
 */
public class RunRequest {
    public String title;
    public String location;
    public Integer distanceMeters;
    public Integer durationSeconds;
    public Integer elevationMeters;
    public String routeType;
    public String startedAt;
    public List<SplitInput> splits;

    public static class SplitInput {
        public Integer km;
        public Integer durationSeconds;
    }
}
