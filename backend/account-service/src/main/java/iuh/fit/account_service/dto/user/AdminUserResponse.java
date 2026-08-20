package iuh.fit.account_service.dto.user;

import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.TutorApplicationStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Set;

public record AdminUserResponse(
        Long id,
        String fullName,
        String email,
        String phone,
        LocalDate dateOfBirth,
        String gender,
        String province,
        String commune,
        String addressDetail,
        String bio,
        String avatarUrl,
        Set<String> roles,
        AccountStatus accountStatus,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        TutorApplicationStatus tutorApplicationStatus,
        Long tutorApplicationId
) {}
