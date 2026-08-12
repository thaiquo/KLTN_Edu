package iuh.fit.learningservice.modules.classroom.dto;

import java.util.UUID;

public record ApprovedSubjectResponse(
    UUID teachingRegistrationId,
    String levelGroup,
    String subjectName,
    String teachingLevel
) {}
