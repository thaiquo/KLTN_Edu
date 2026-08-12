package iuh.fit.learningservice.modules.classroom.dto;

import iuh.fit.learningservice.modules.classroom.entity.ClassRoomStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ClassRoomResponse(
    UUID id,
    UUID tutorId,
    UUID teachingRegistrationId,
    String subjectName,
    String teachingLevel,
    String name,
    String description,
    int maxStudents,
    int currentStudents,
    int sessionsPerWeek,
    int sessionDurationMinutes,
    int durationValue,
    String durationUnit,
    LocalDate startDate,
    LocalDate endDate,
    BigDecimal totalPrice,
    BigDecimal pricePerSession,
    BigDecimal averageHourlyRate,
    int totalSessions,
    ClassRoomStatus status,
    List<ClassScheduleResponse> schedules,
    List<SessionResponse> sessions,
    Instant createdAt,
    Instant updatedAt
) {}
