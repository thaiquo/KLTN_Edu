package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.user.AdminUserResponse;
import iuh.fit.account_service.dto.user.CreateStaffRequest;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import iuh.fit.account_service.service.storage.FileStorageService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AdminUserServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserRoleRepository userRoleRepository = mock(UserRoleRepository.class);
    private final TutorApplicationRepository tutorApplicationRepository = mock(TutorApplicationRepository.class);
    private final TutorApprovalService tutorApprovalService = mock(TutorApprovalService.class);
    private final FileStorageService fileStorageService = mock(FileStorageService.class);
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final RefreshTokenService refreshTokenService = mock(RefreshTokenService.class);

    private AdminUserService adminUserService;

    @BeforeEach
    void setUp() {
        adminUserService = new AdminUserService(
                userRepository,
                userRoleRepository,
                tutorApplicationRepository,
                tutorApprovalService,
                fileStorageService,
                passwordEncoder,
                refreshTokenService
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin@educonnect.vn", "n/a", List.of())
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createStaff_success() {
        CreateStaffRequest request = new CreateStaffRequest();
        request.setFullName("Staff Nguyen");
        request.setEmail("STAFF.NEW@educonnect.vn");
        request.setPhone("0988123456");
        request.setPassword("StaffPass123");

        when(userRepository.existsByEmailIgnoreCase("staff.new@educonnect.vn")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(101L);
            return u;
        });

        AdminUserResponse response = adminUserService.createStaff(request);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(101L);
        assertThat(response.email()).isEqualTo("staff.new@educonnect.vn");
        assertThat(response.fullName()).isEqualTo("Staff Nguyen");
        assertThat(response.roles()).containsExactly("STAFF");
        assertThat(response.accountStatus()).isEqualTo(AccountStatus.ACTIVE);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();
        assertThat(savedUser.isEmailVerified()).isTrue();
        assertThat(passwordEncoder.matches("StaffPass123", savedUser.getPassword())).isTrue();

        verify(userRoleRepository).save(any(UserRole.class));
    }

    @Test
    void createStaff_duplicateEmail_throwsBadRequest() {
        CreateStaffRequest request = new CreateStaffRequest();
        request.setFullName("Staff Nguyen");
        request.setEmail("existing@educonnect.vn");
        request.setPassword("StaffPass123");

        when(userRepository.existsByEmailIgnoreCase("existing@educonnect.vn")).thenReturn(true);

        assertThatThrownBy(() -> adminUserService.createStaff(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Email đã được sử dụng");
    }

    @Test
    void updateUserStatus_lockUser_revokesSessions() {
        User targetUser = User.builder()
                .id(202L)
                .email("student@educonnect.vn")
                .fullName("Student A")
                .accountStatus(AccountStatus.ACTIVE)
                .build();

        when(userRepository.findById(202L)).thenReturn(Optional.of(targetUser));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(userRoleRepository.existsByUserIdAndRole(202L, Role.ADMIN)).thenReturn(false);

        AdminUserResponse response = adminUserService.updateUserStatus(202L, AccountStatus.LOCKED);

        assertThat(response.accountStatus()).isEqualTo(AccountStatus.LOCKED);
        verify(refreshTokenService).revokeAllForUser(targetUser);
    }

    @Test
    void updateUserStatus_selfLock_throwsBadRequest() {
        User adminUser = User.builder()
                .id(1L)
                .email("admin@educonnect.vn")
                .fullName("Admin Super")
                .accountStatus(AccountStatus.ACTIVE)
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

        assertThatThrownBy(() -> adminUserService.updateUserStatus(1L, AccountStatus.LOCKED))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("không thể tự khóa hoặc vô hiệu hóa tài khoản của chính mình");
    }

    @Test
    void updateUserStatus_lockAdminTarget_throwsBadRequest() {
        User anotherAdmin = User.builder()
                .id(2L)
                .email("another.admin@educonnect.vn")
                .fullName("Admin Two")
                .accountStatus(AccountStatus.ACTIVE)
                .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(anotherAdmin));
        when(userRoleRepository.existsByUserIdAndRole(2L, Role.ADMIN)).thenReturn(true);

        assertThatThrownBy(() -> adminUserService.updateUserStatus(2L, AccountStatus.LOCKED))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Không thể khóa hoặc vô hiệu hóa tài khoản Quản trị viên");
    }

    @Test
    void updateUserStatus_disabledUserToActive_throwsBadRequest() {
        User disabledUser = User.builder()
                .id(404L)
                .email("disabled.staff@educonnect.vn")
                .fullName("Disabled Staff")
                .accountStatus(AccountStatus.DISABLED)
                .build();

        when(userRepository.findById(404L)).thenReturn(Optional.of(disabledUser));

        assertThatThrownBy(() -> adminUserService.updateUserStatus(404L, AccountStatus.ACTIVE))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("không thể mở khóa bằng thao tác khóa/mở khóa thông thường");

        verify(userRepository, never()).save(any(User.class));
        verify(refreshTokenService, never()).revokeAllForUser(any(User.class));
    }

    @Test
    void deleteUser_setsStatusDisabled_andRevokesSessions() {
        User targetUser = User.builder()
                .id(303L)
                .email("tutor@educonnect.vn")
                .fullName("Tutor B")
                .accountStatus(AccountStatus.ACTIVE)
                .build();

        when(userRepository.findById(303L)).thenReturn(Optional.of(targetUser));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(userRoleRepository.existsByUserIdAndRole(303L, Role.ADMIN)).thenReturn(false);

        AdminUserResponse response = adminUserService.deleteUser(303L);

        assertThat(response.accountStatus()).isEqualTo(AccountStatus.DISABLED);
        verify(refreshTokenService).revokeAllForUser(targetUser);
    }
}
