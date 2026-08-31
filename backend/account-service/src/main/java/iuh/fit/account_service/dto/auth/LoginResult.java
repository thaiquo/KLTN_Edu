package iuh.fit.account_service.dto.auth;

import lombok.Getter;

import java.util.List;

@Getter
public class LoginResult {

    private Long userId;
    private String email;
    private String fullName;
    private List<String> roles;
    private String activeRole;
    private boolean hasStudentProfile;
    private boolean hasTutorProfile;
    private String tutorStatus;
    private String token;
    private String refreshToken;

    public LoginResult(Long userId, String email, String fullName, List<String> roles, String token) {
        this(userId, email, fullName, roles, null, false, false, null, token);
    }

    public LoginResult(
            Long userId,
            String email,
            String fullName,
            List<String> roles,
            String activeRole,
            boolean hasStudentProfile,
            boolean hasTutorProfile,
            String tutorStatus,
            String token
    ) {
        this(userId, email, fullName, roles, activeRole, hasStudentProfile, hasTutorProfile, tutorStatus, token, null);
    }

    public LoginResult(
            Long userId,
            String email,
            String fullName,
            List<String> roles,
            String activeRole,
            boolean hasStudentProfile,
            boolean hasTutorProfile,
            String tutorStatus,
            String token,
            String refreshToken
    ) {
        this.userId = userId;
        this.email = email;
        this.fullName = fullName;
        this.roles = roles;
        this.activeRole = activeRole;
        this.hasStudentProfile = hasStudentProfile;
        this.hasTutorProfile = hasTutorProfile;
        this.tutorStatus = tutorStatus;
        this.token = token;
        this.refreshToken = refreshToken;
    }

    public Long getUserId() {
        return userId;
    }

    public String getEmail() {
        return email;
    }

    public String getFullName() {
        return fullName;
    }

    public List<String> getRoles() {
        return roles;
    }

    public String getActiveRole() {
        return activeRole;
    }

    public boolean isHasStudentProfile() {
        return hasStudentProfile;
    }

    public boolean isHasTutorProfile() {
        return hasTutorProfile;
    }

    public String getTutorStatus() {
        return tutorStatus;
    }

    public String getToken() {
        return token;
    }

    public String getRefreshToken() {
        return refreshToken;
    }
}
