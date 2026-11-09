package iuh.fit.account_service.enums;

import java.time.LocalTime;

public enum ShiftCode {
    MORNING(LocalTime.of(8, 0), LocalTime.of(15, 0)),
    EVENING(LocalTime.of(15, 0), LocalTime.of(22, 0));

    private final LocalTime startTime;
    private final LocalTime endTime;

    ShiftCode(LocalTime startTime, LocalTime endTime) {
        this.startTime = startTime;
        this.endTime = endTime;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }
}
