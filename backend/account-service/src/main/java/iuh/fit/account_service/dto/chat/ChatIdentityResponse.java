package iuh.fit.account_service.dto.chat;

import iuh.fit.account_service.enums.AccountStatus;

import java.util.List;

public record ChatIdentityResponse(
        Long userId,
        String email,
        String fullName,
        String avatarUrl,
        AccountStatus accountStatus,
        List<String> roles,
        boolean hasStudentProfile,
        boolean hasTutorProfile,
        boolean tutorApproved,
        Long tutorProfileId
) {
}
