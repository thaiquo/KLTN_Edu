package iuh.fit.account_service.modules.tutor.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record TeachingSubjectRequest(
    @NotBlank @Size(max = 64) String levelGroup,
    @NotBlank @Size(max = 255) String subjectName,
    @NotBlank @Size(max = 128) String teachingLevel,
    @NotBlank @Size(max = 5000) String bio,
    @NotBlank @Size(max = 5000) String experience,
    @NotEmpty @Size(max = 5) List<@Valid CertificateRequest> certificates
) {}
