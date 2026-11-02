package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.staff.StaffTutorApplicationDetailResponse;
import iuh.fit.account_service.dto.user.AdminUserDetailResponse;
import iuh.fit.account_service.dto.user.AdminUserResponse;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import iuh.fit.account_service.service.storage.FileStorageService;
import iuh.fit.account_service.dto.user.CreateStaffRequest;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.util.EmailNormalizer;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.criteria.Subquery;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AdminUserService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final TutorApplicationRepository tutorApplicationRepository;
    private final TutorApprovalService tutorApprovalService;
    private final FileStorageService fileStorageService;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokenService;

    public AdminUserService(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            TutorApplicationRepository tutorApplicationRepository,
            TutorApprovalService tutorApprovalService,
            FileStorageService fileStorageService,
            PasswordEncoder passwordEncoder,
            RefreshTokenService refreshTokenService
    ) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.tutorApplicationRepository = tutorApplicationRepository;
        this.tutorApprovalService = tutorApprovalService;
        this.fileStorageService = fileStorageService;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokenService = refreshTokenService;
    }

    @Transactional(readOnly = true)
    public Page<AdminUserResponse> listUsers(String search, String roleFilter, String statusFilter, Pageable pageable) {
        Specification<User> spec = userSpecification(search, roleFilter, statusFilter);
        Page<User> users = userRepository.findAll(spec, pageable);
        List<Long> userIds = users.stream().map(User::getId).toList();
        List<UserRole> allRoles = userIds.isEmpty() ? List.of() : userRoleRepository.findByUserIdIn(userIds);
        List<TutorApplication> allApps = userIds.isEmpty() ? List.of() : tutorApplicationRepository.findByUserIdIn(userIds);

        Map<Long, Set<String>> rolesByUserId = allRoles.stream()
                .collect(Collectors.groupingBy(
                        ur -> ur.getUser().getId(),
                        Collectors.mapping(ur -> ur.getRole().name(), Collectors.toSet())
                ));

        Map<Long, TutorApplication> appByUserId = allApps.stream()
                .collect(Collectors.toMap(
                        app -> app.getUser().getId(),
                        app -> app,
                        (existing, replacement) -> existing
                ));

        return users.map(u -> {
                    Set<String> roles = rolesByUserId.getOrDefault(u.getId(), Set.of());
                    TutorApplication app = appByUserId.get(u.getId());
                    return toAdminResponse(u, roles, app);
                });
    }

    private Specification<User> userSpecification(String search, String roleFilter, String statusFilter) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new java.util.ArrayList<>();
            if (StringUtils.hasText(search)) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("fullName")), pattern),
                        cb.like(cb.lower(root.get("email")), pattern),
                        cb.like(cb.lower(root.get("phone")), pattern)
                ));
            }
            if (StringUtils.hasText(statusFilter) && !"ALL".equalsIgnoreCase(statusFilter)) {
                predicates.add(cb.equal(root.get("accountStatus"), AccountStatus.valueOf(statusFilter.trim().toUpperCase())));
            }
            if (StringUtils.hasText(roleFilter) && !"ALL".equalsIgnoreCase(roleFilter)) {
                Role role = Role.valueOf(roleFilter.trim().toUpperCase());
                Subquery<Long> roleQuery = query.subquery(Long.class);
                var roleRoot = roleQuery.from(UserRole.class);
                roleQuery.select(roleRoot.get("user").get("id"))
                        .where(cb.and(
                                cb.equal(roleRoot.get("user").get("id"), root.get("id")),
                                cb.equal(roleRoot.get("role"), role)
                        ));
                predicates.add(cb.exists(roleQuery));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getUserStats() {
        return Map.of(
                "total", userRepository.count(),
                "tutors", userRoleRepository.countByRole(Role.TUTOR),
                "students", userRoleRepository.countByRole(Role.STUDENT),
                "operators", userRoleRepository.countByRole(Role.ADMIN) + userRoleRepository.countByRole(Role.STAFF),
                "suspended", userRepository.countByAccountStatus(AccountStatus.LOCKED)
                        + userRepository.countByAccountStatus(AccountStatus.DISABLED)
        );
    }

    @Transactional(readOnly = true)
    public AdminUserDetailResponse getUserDetail(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        Set<String> roles = userRoleRepository.findByUserId(userId).stream()
                .map(ur -> ur.getRole().name())
                .collect(Collectors.toSet());

        Optional<TutorApplication> appOpt = tutorApplicationRepository.findByUserId(userId);
        TutorApplication app = appOpt.orElse(null);

        AdminUserResponse adminUser = toAdminResponse(user, roles, app);
        StaffTutorApplicationDetailResponse tutorDetail = null;

        if (app != null) {
            try {
                tutorDetail = tutorApprovalService.getApplicationDetail(app.getId());
            } catch (Exception ignored) {}
        }

        return new AdminUserDetailResponse(adminUser, tutorDetail);
    }

    @Transactional
    public AdminUserResponse createStaff(CreateStaffRequest request) {
        String normalizedEmail = EmailNormalizer.normalize(request.getEmail());
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new BadRequestException("Email đã được sử dụng trong hệ thống");
        }

        User user = User.builder()
                .email(normalizedEmail)
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .phone(request.getPhone() != null && !request.getPhone().isBlank() ? request.getPhone().trim() : null)
                .emailVerified(true)
                .accountStatus(AccountStatus.ACTIVE)
                .build();

        User savedUser = userRepository.save(user);

        UserRole userRole = new UserRole();
        userRole.setUser(savedUser);
        userRole.setRole(Role.STAFF);
        userRoleRepository.save(userRole);

        return toAdminResponse(savedUser, Set.of("STAFF"), null);
    }

    @Transactional
    public AdminUserResponse updateUserStatus(Long userId, AccountStatus status) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        validateAdminSelfOrTargetProtection(user, status);

        user.setAccountStatus(status);
        User saved = userRepository.save(user);

        if (status == AccountStatus.LOCKED || status == AccountStatus.DISABLED) {
            refreshTokenService.revokeAllForUser(user);
        }

        Set<String> roles = userRoleRepository.findByUserId(userId).stream()
                .map(ur -> ur.getRole().name())
                .collect(Collectors.toSet());

        TutorApplication app = tutorApplicationRepository.findByUserId(userId).orElse(null);
        return toAdminResponse(saved, roles, app);
    }

    @Transactional
    public AdminUserResponse deleteUser(Long userId) {
        return updateUserStatus(userId, AccountStatus.DISABLED);
    }

    private void validateAdminSelfOrTargetProtection(User targetUser, AccountStatus nextStatus) {
        if (targetUser.getAccountStatus() == AccountStatus.DISABLED && nextStatus == AccountStatus.ACTIVE) {
            throw new BadRequestException("Tài khoản đã bị vô hiệu hóa không thể mở khóa bằng thao tác khóa/mở khóa thông thường");
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null) {
            String currentEmail = auth.getName();
            if (targetUser.getEmail() != null
                    && targetUser.getEmail().equalsIgnoreCase(currentEmail)
                    && (nextStatus == AccountStatus.LOCKED || nextStatus == AccountStatus.DISABLED)) {
                throw new BadRequestException("Bạn không thể tự khóa hoặc vô hiệu hóa tài khoản của chính mình");
            }
        }

        boolean isTargetAdmin = userRoleRepository.existsByUserIdAndRole(targetUser.getId(), Role.ADMIN);
        if (isTargetAdmin && (nextStatus == AccountStatus.LOCKED || nextStatus == AccountStatus.DISABLED)) {
            throw new BadRequestException("Không thể khóa hoặc vô hiệu hóa tài khoản Quản trị viên");
        }
    }

    private AdminUserResponse toAdminResponse(User u, Set<String> roles, TutorApplication app) {
        String avatarUrl = resolveAvatarUrl(u.getAvatarKey());
        TutorApplicationStatus appStatus = app != null ? app.getStatus() : null;
        Long appId = app != null ? app.getId() : null;

        return new AdminUserResponse(
                u.getId(),
                u.getFullName(),
                u.getEmail(),
                u.getPhone(),
                u.getDateOfBirth(),
                u.getGender(),
                u.getProvince(),
                u.getCommune() != null ? u.getCommune() : u.getWard(),
                u.getAddressDetail(),
                u.getBio(),
                avatarUrl,
                roles,
                u.getAccountStatus(),
                u.getCreatedAt(),
                u.getUpdatedAt(),
                appStatus,
                appId
        );
    }

    private String resolveAvatarUrl(String avatarKey) {
        if (!StringUtils.hasText(avatarKey) || fileStorageService == null) {
            return null;
        }
        try {
            return fileStorageService.createPresignedGetUrl(avatarKey);
        } catch (Exception e) {
            return null;
        }
    }
}
