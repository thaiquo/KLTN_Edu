package iuh.fit.account_service.dto.user;

import iuh.fit.account_service.enums.AccountStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class UserProfileResponse {

    private Long id;
    private String fullName;
    private String email;
    private String phone;
    private LocalDate dateOfBirth;
    private String avatarKey;
    private String avatarUrl;
    private String gender;
    private String provinceCode;
    private String province;
    private String communeCode;
    private String commune;
    private String district;
    private String ward;
    private String addressDetail;
    private String bio;
    private boolean emailVerified;
    private AccountStatus accountStatus;
    private List<String> roles;
    private String activeRole;
    private boolean hasStudentProfile;
    private boolean hasTutorProfile;
    private String tutorStatus;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public UserProfileResponse(
            Long id,
            String fullName,
            String email,
            String phone,
            LocalDate dateOfBirth,
            boolean emailVerified,
            AccountStatus accountStatus,
            List<String> roles
    ) {
        this(id, fullName, email, phone, dateOfBirth, null, null, null, null, null, null, null, null, null, null, null,
                emailVerified, accountStatus, roles, null, false, false, null, null, null);
    }

    public UserProfileResponse(
            Long id,
            String fullName,
            String email,
            String phone,
            LocalDate dateOfBirth,
            String avatarKey,
            String avatarUrl,
            String gender,
            String provinceCode,
            String province,
            String communeCode,
            String commune,
            String district,
            String ward,
            String addressDetail,
            String bio,
            boolean emailVerified,
            AccountStatus accountStatus,
            List<String> roles,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        this(id, fullName, email, phone, dateOfBirth, avatarKey, avatarUrl, gender, provinceCode, province,
                communeCode, commune, district, ward, addressDetail, bio, emailVerified, accountStatus, roles,
                null, false, false, null, createdAt, updatedAt);
    }

    public UserProfileResponse(
            Long id,
            String fullName,
            String email,
            String phone,
            LocalDate dateOfBirth,
            String avatarKey,
            String avatarUrl,
            String gender,
            String provinceCode,
            String province,
            String communeCode,
            String commune,
            String district,
            String ward,
            String addressDetail,
            String bio,
            boolean emailVerified,
            AccountStatus accountStatus,
            List<String> roles,
            String activeRole,
            boolean hasStudentProfile,
            boolean hasTutorProfile,
            String tutorStatus,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        this.id = id;
        this.fullName = fullName;
        this.email = email;
        this.phone = phone;
        this.dateOfBirth = dateOfBirth;
        this.avatarKey = avatarKey;
        this.avatarUrl = avatarUrl;
        this.gender = gender;
        this.provinceCode = provinceCode;
        this.province = province;
        this.communeCode = communeCode;
        this.commune = commune;
        this.district = district;
        this.ward = ward;
        this.addressDetail = addressDetail;
        this.bio = bio;
        this.emailVerified = emailVerified;
        this.accountStatus = accountStatus;
        this.roles = roles;
        this.activeRole = activeRole;
        this.hasStudentProfile = hasStudentProfile;
        this.hasTutorProfile = hasTutorProfile;
        this.tutorStatus = tutorStatus;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public String getFullName() {
        return fullName;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public String getAvatarKey() {
        return avatarKey;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public String getGender() {
        return gender;
    }

    public String getProvince() {
        return province;
    }

    public String getProvinceCode() {
        return provinceCode;
    }

    public String getCommuneCode() {
        return communeCode;
    }

    public String getCommune() {
        return commune;
    }

    public String getDistrict() {
        return district;
    }

    public String getWard() {
        return ward;
    }

    public String getAddressDetail() {
        return addressDetail;
    }

    public String getBio() {
        return bio;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public AccountStatus getAccountStatus() {
        return accountStatus;
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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
