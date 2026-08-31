package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.user.ChangePasswordRequest;
import iuh.fit.account_service.dto.user.UpdateUserProfileRequest;
import iuh.fit.account_service.config.FilePolicyProperties;
import iuh.fit.account_service.entity.AdministrativeCommune;
import iuh.fit.account_service.entity.AdministrativeProvince;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.FileValidationException;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import iuh.fit.account_service.repository.AdministrativeCommuneRepository;
import iuh.fit.account_service.repository.AdministrativeProvinceRepository;
import iuh.fit.account_service.repository.StudentRepository;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.service.storage.FileStorageService;
import iuh.fit.account_service.service.storage.StoredFile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserRoleRepository userRoleRepository = mock(UserRoleRepository.class);
    private final StudentRepository studentRepository = mock(StudentRepository.class);
    private final TutorRepository tutorRepository = mock(TutorRepository.class);
    private final TutorApplicationRepository tutorApplicationRepository = mock(TutorApplicationRepository.class);
    private final AdministrativeProvinceRepository provinceRepository = mock(AdministrativeProvinceRepository.class);
    private final AdministrativeCommuneRepository communeRepository = mock(AdministrativeCommuneRepository.class);
    private final FileStorageService fileStorageService = mock(FileStorageService.class);
    private final FilePolicyProperties filePolicyProperties = filePolicyProperties();
    private final RefreshTokenService refreshTokenService = mock(RefreshTokenService.class);
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private UserService userService;
    private User user;

    @BeforeEach
    void setUp() {
        userService = new UserService(
                userRepository,
                userRoleRepository,
                studentRepository,
                tutorRepository,
                passwordEncoder,
                fileStorageService,
                filePolicyProperties,
                provinceRepository,
                communeRepository,
                tutorApplicationRepository,
                refreshTokenService
        );

        user = new User();
        ReflectionTestUtils.setField(user, "id", 7L);
        user.setEmail("test@example.com");
        user.setPassword(passwordEncoder.encode("oldPassword123"));
        user.setFullName("Test User");
        user.setPhone("0912345678");
        user.setDateOfBirth(LocalDate.of(2000, 1, 2));
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);
    }

    @Test
    void getCurrentUserProfileReturnsBasicAccountDataAndAllRoles() {
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(userRoleRepository.findByUserId(7L)).thenReturn(List.of(
                role(user, Role.STUDENT),
                role(user, Role.TUTOR)
        ));

        var response = userService.getCurrentUserProfile(" TEST@example.com ");

        assertThat(response.getId()).isEqualTo(7L);
        assertThat(response.getEmail()).isEqualTo("test@example.com");
        assertThat(response.getFullName()).isEqualTo("Test User");
        assertThat(response.getPhone()).isEqualTo("0912345678");
        assertThat(response.getDateOfBirth()).isEqualTo(LocalDate.of(2000, 1, 2));
        assertThat(response.isEmailVerified()).isTrue();
        assertThat(response.getAccountStatus()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(response.getRoles()).containsExactly("STUDENT", "TUTOR");
    }

    @Test
    void updateCurrentUserProfilePersistsOnlyMutableBasicFields() {
        UpdateUserProfileRequest request = new UpdateUserProfileRequest();
        request.setFullName("  Updated User  ");
        request.setPhone("  +84901234567  ");
        request.setDateOfBirth(LocalDate.of(1999, 5, 6));
        request.setGender("  Female  ");
        request.setProvinceCode("HO_CHI_MINH");
        request.setCommuneCode("HCM_GO_VAP");
        request.setAddressDetail("  12 Nguyen Van Bao  ");
        request.setBio("  Xin chao  ");
        AdministrativeProvince province = province("HO_CHI_MINH", "Thành phố Hồ Chí Minh");
        AdministrativeCommune commune = commune("HCM_GO_VAP", "Phường Gò Vấp", province);
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(provinceRepository.findByCodeAndActiveTrue("HO_CHI_MINH")).thenReturn(Optional.of(province));
        when(communeRepository.findByCodeAndActiveTrue("HCM_GO_VAP")).thenReturn(Optional.of(commune));
        when(userRepository.save(user)).thenReturn(user);
        when(userRoleRepository.findByUserId(7L)).thenReturn(List.of(role(user, Role.STUDENT)));

        var response = userService.updateCurrentUserProfile("test@example.com", request);

        assertThat(user.getFullName()).isEqualTo("Updated User");
        assertThat(user.getPhone()).isEqualTo("+84901234567");
        assertThat(user.getDateOfBirth()).isEqualTo(LocalDate.of(1999, 5, 6));
        assertThat(user.getGender()).isEqualTo("Female");
        assertThat(user.getProvinceCode()).isEqualTo("HO_CHI_MINH");
        assertThat(user.getProvince()).isEqualTo("Thành phố Hồ Chí Minh");
        assertThat(user.getCommuneCode()).isEqualTo("HCM_GO_VAP");
        assertThat(user.getCommune()).isEqualTo("Phường Gò Vấp");
        assertThat(user.getDistrict()).isNull();
        assertThat(user.getWard()).isEqualTo("Phường Gò Vấp");
        assertThat(user.getAddressDetail()).isEqualTo("12 Nguyen Van Bao");
        assertThat(user.getBio()).isEqualTo("Xin chao");
        assertThat(user.getEmail()).isEqualTo("test@example.com");
        assertThat(user.getAccountStatus()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(response.getRoles()).containsExactly("STUDENT");
        verify(userRepository).save(user);
    }

    @Test
    void updateCurrentUserProfileRejectsCommuneOutsideSelectedProvince() {
        UpdateUserProfileRequest request = new UpdateUserProfileRequest();
        request.setFullName("Test User");
        request.setProvinceCode("HO_CHI_MINH");
        request.setCommuneCode("HN_HOAN_KIEM");
        AdministrativeProvince hcm = province("HO_CHI_MINH", "Thành phố Hồ Chí Minh");
        AdministrativeProvince hn = province("HA_NOI", "Thành phố Hà Nội");
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(provinceRepository.findByCodeAndActiveTrue("HO_CHI_MINH")).thenReturn(Optional.of(hcm));
        when(communeRepository.findByCodeAndActiveTrue("HN_HOAN_KIEM")).thenReturn(Optional.of(commune("HN_HOAN_KIEM", "Phường Hoàn Kiếm", hn)));

        assertThatThrownBy(() -> userService.updateCurrentUserProfile("test@example.com", request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Commune does not belong to selected province");
    }

    @Test
    void updateCurrentUserProfileCanClearPhoneWithBlankValue() {
        UpdateUserProfileRequest request = new UpdateUserProfileRequest();
        request.setFullName("Test User");
        request.setPhone("   ");
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(userRoleRepository.findByUserId(7L)).thenReturn(List.of());

        userService.updateCurrentUserProfile("test@example.com", request);

        assertThat(user.getPhone()).isNull();
    }

    @Test
    void updateCurrentUserAvatarStoresValidatedImageAndReturnsAvatarUrl() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.png",
                "image/png",
                new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        );
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(userRoleRepository.findByUserId(7L)).thenReturn(List.of(role(user, Role.STUDENT)));
        when(fileStorageService.store(org.mockito.ArgumentMatchers.startsWith("users/7/avatar/"), org.mockito.ArgumentMatchers.any(byte[].class), org.mockito.ArgumentMatchers.eq("image/png")))
                .thenAnswer(invocation -> new StoredFile(invocation.getArgument(0), "image/png", 8));
        when(fileStorageService.createPresignedGetUrl(org.mockito.ArgumentMatchers.anyString())).thenReturn("https://signed.example/avatar");

        var response = userService.updateCurrentUserAvatar("test@example.com", file);

        assertThat(user.getAvatarKey()).startsWith("users/7/avatar/");
        assertThat(response.getAvatarKey()).isEqualTo(user.getAvatarKey());
        assertThat(response.getAvatarUrl()).isEqualTo("https://signed.example/avatar");
        verify(fileStorageService).store(org.mockito.ArgumentMatchers.startsWith("users/7/avatar/"), org.mockito.ArgumentMatchers.any(byte[].class), org.mockito.ArgumentMatchers.eq("image/png"));
    }

    @Test
    void updateCurrentUserAvatarRejectsInvalidImageSignature() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.png",
                "image/png",
                new byte[] {0x01, 0x02, 0x03, 0x04}
        );
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.updateCurrentUserAvatar("test@example.com", file))
                .isInstanceOf(FileValidationException.class);
    }

    @Test
    void changePasswordSuccessEncodesNewPassword() {
        ChangePasswordRequest request = changePasswordRequest("oldPassword123", "newPassword123", "newPassword123");
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));

        userService.changePassword("test@example.com", request);

        assertThat(passwordEncoder.matches("newPassword123", user.getPassword())).isTrue();
        assertThat(passwordEncoder.matches("oldPassword123", user.getPassword())).isFalse();
        verify(userRepository).save(user);
        verify(refreshTokenService).revokeAllForUser(user);
    }

    @Test
    void changePasswordWrongCurrentPasswordIsRejected() {
        ChangePasswordRequest request = changePasswordRequest("wrongPassword", "newPassword123", "newPassword123");
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.changePassword("test@example.com", request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Current password is incorrect");
    }

    @Test
    void changePasswordMismatchIsRejected() {
        ChangePasswordRequest request = changePasswordRequest("oldPassword123", "newPassword123", "different123");

        assertThatThrownBy(() -> userService.changePassword("test@example.com", request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Passwords do not match");
    }

    private ChangePasswordRequest changePasswordRequest(
            String currentPassword,
            String newPassword,
            String confirmPassword
    ) {
        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setCurrentPassword(currentPassword);
        request.setNewPassword(newPassword);
        request.setConfirmPassword(confirmPassword);
        return request;
    }

    private UserRole role(User user, Role role) {
        UserRole userRole = new UserRole();
        userRole.setUser(user);
        userRole.setRole(role);
        return userRole;
    }

    private FilePolicyProperties filePolicyProperties() {
        FilePolicyProperties properties = new FilePolicyProperties();
        properties.getAvatar().setAllowedContentTypes(List.of("image/jpeg", "image/png", "image/webp"));
        properties.getAvatar().setAllowedExtensions(List.of("jpg", "jpeg", "png", "webp"));
        properties.getAvatar().setMaxSize(org.springframework.util.unit.DataSize.ofMegabytes(2));
        return properties;
    }

    private AdministrativeProvince province(String code, String name) {
        AdministrativeProvince province = new AdministrativeProvince();
        province.setCode(code);
        province.setName(name);
        province.setActive(true);
        return province;
    }

    private AdministrativeCommune commune(String code, String name, AdministrativeProvince province) {
        AdministrativeCommune commune = new AdministrativeCommune();
        commune.setCode(code);
        commune.setName(name);
        commune.setProvince(province);
        commune.setActive(true);
        return commune;
    }
}
