package iuh.fit.learningservice.modules.classroom.dto;

import iuh.fit.learningservice.modules.session.entity.SessionStatus;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record SessionResponse(
    UUID id,
    LocalDate date,
    LocalTime startTime,
    LocalTime endTime,
    String link,
    SessionStatus status
) {}
