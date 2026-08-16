package iuh.fit.account_service.dto.auth;

import lombok.Getter;

import java.util.List;

@Getter
public class LoginResponse {

    private Long userId;
    private String email;
    private String fullName;
    private List<String> roles;
    private String activeRole;
    private boolean hasStudentProfile;
    private boolean hasTutorProfile;
    private String tutorStatus;

    public LoginResponse(Long userId, String email, String fullName, List<String> roles) {
        this(userId, email, fullName, roles, null, false, false, null);
    }

    public LoginResponse(
            Long userId,
            String email,
            String fullName,
            List<String> roles,
            String activeRole,
            boolean hasStudentProfile,
            boolean hasTutorProfile,
            String tutorStatus
    ) {
        this.userId = userId;
        this.email = email;
        this.fullName = fullName;
        this.roles = roles;
        this.activeRole = activeRole;
        this.hasStudentProfile = hasStudentProfile;
        this.hasTutorProfile = hasTutorProfile;
        this.tutorStatus = tutorStatus;
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
}
