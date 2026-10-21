package iuh.fit.account_service.dto.auth;

import java.util.List;

public record MobileSessionResponse(
        Long userId,
        String email,
        String fullName,
        List<String> roles,
        String activeRole,
        boolean hasStudentProfile,
        boolean hasTutorProfile,
        String tutorStatus,
        String accessToken,
        String refreshToken,
        long expiresInSeconds
) {
    public static MobileSessionResponse from(LoginResult result, long expirationMillis) {
        return new MobileSessionResponse(result.getUserId(), result.getEmail(), result.getFullName(),
                result.getRoles(), result.getActiveRole(), result.isHasStudentProfile(),
                result.isHasTutorProfile(), result.getTutorStatus(), result.getToken(),
                result.getRefreshToken(), expirationMillis / 1000);
    }
}
