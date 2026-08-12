package iuh.fit.learningservice.modules.classroom.dto;

import jakarta.validation.constraints.NotNull;

import java.time.DayOfWeek;
import java.time.LocalTime;

public record ScheduleItemRequest(
    @NotNull DayOfWeek dayOfWeek,
    @NotNull LocalTime startTime
) {}
