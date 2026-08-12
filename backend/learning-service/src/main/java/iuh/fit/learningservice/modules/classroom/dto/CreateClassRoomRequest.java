package iuh.fit.learningservice.modules.classroom.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record CreateClassRoomRequest(
    @NotNull UUID teachingRegistrationId,
    @NotBlank String teachingLevel,
    @NotBlank @Size(max = 255) String name,
    @NotBlank String description,
    @Min(1) int maxStudents,
    @Min(1) int sessionsPerWeek,
    @Min(1) int sessionDurationMinutes,
    @Min(1) int durationValue,
    @NotBlank String durationUnit,
    @NotNull LocalDate startDate,
    @NotEmpty List<@Valid ScheduleItemRequest> schedules,
    @NotNull BigDecimal totalPrice
) {}
