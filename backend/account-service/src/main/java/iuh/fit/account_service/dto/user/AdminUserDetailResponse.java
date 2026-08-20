package iuh.fit.account_service.dto.user;

import iuh.fit.account_service.dto.staff.StaffTutorApplicationDetailResponse;

public record AdminUserDetailResponse(
        AdminUserResponse user,
        StaffTutorApplicationDetailResponse tutorDetail
) {}
