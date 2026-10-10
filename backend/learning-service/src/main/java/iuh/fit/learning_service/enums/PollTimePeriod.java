package iuh.fit.learning_service.enums;

import java.time.LocalTime;

public enum PollTimePeriod {
    MORNING("Sáng", LocalTime.of(7, 0), LocalTime.of(13, 0)),
    AFTERNOON("Chiều", LocalTime.of(13, 0), LocalTime.of(18, 0)),
    EVENING("Tối", LocalTime.of(18, 0), LocalTime.of(23, 0));

    private final String label;
    private final LocalTime start;
    private final LocalTime endExclusive;

    PollTimePeriod(String label, LocalTime start, LocalTime endExclusive) {
        this.label = label;
        this.start = start;
        this.endExclusive = endExclusive;
    }

    public String getLabel() {
        return label;
    }

    public LocalTime getStart() {
        return start;
    }

    public LocalTime getEndExclusive() {
        return endExclusive;
    }

    public static PollTimePeriod fromStartTime(LocalTime startTime) {
        if (startTime == null || startTime.isBefore(AFTERNOON.start)) return MORNING;
        if (startTime.isBefore(EVENING.start)) return AFTERNOON;
        return EVENING;
    }
}
