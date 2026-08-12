package iuh.fit.account_service.modules.tutor.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.util.List;

public record TutorApplicationRequest(
    @Size(max = 20) List<@Valid CertificateRequest> certificates,
    @Size(min = 1, max = 20) List<@Valid TeachingSubjectRequest> teachingSubjects
) {
}
