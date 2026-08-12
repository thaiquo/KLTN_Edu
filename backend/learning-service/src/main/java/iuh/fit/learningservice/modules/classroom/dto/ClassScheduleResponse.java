package iuh.fit.learningservice.modules.classroom.dto;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.UUID;

public record ClassScheduleResponse(
    UUID id,
    DayOfWeek dayOfWeek,
    LocalTime startTime,
    LocalTime endTime
) {}
