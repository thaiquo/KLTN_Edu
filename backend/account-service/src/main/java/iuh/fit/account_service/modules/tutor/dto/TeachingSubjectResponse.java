package iuh.fit.account_service.modules.tutor.dto;

import java.util.List;
import java.util.UUID;

public record TeachingSubjectResponse(
    UUID id, String levelGroup, String subjectName, String teachingLevel,
    String bio, String experience, List<CertificateResponse> certificates
) {}
