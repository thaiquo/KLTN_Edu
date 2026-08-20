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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

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

    public AdminUserService(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            TutorApplicationRepository tutorApplicationRepository,
            TutorApprovalService tutorApprovalService,
            FileStorageService fileStorageService
    ) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.tutorApplicationRepository = tutorApplicationRepository;
        this.tutorApprovalService = tutorApprovalService;
        this.fileStorageService = fileStorageService;
    }

    @Transactional(readOnly = true)
    public List<AdminUserResponse> listUsers(String search, String roleFilter, String statusFilter) {
        List<User> users = userRepository.findAll();
        List<UserRole> allRoles = userRoleRepository.findAll();
        List<TutorApplication> allApps = tutorApplicationRepository.findAll();

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

        return users.stream()
                .filter(u -> {
                    if (StringUtils.hasText(search)) {
                        String q = search.toLowerCase().trim();
                        boolean matchName = u.getFullName() != null && u.getFullName().toLowerCase().contains(q);
                        boolean matchEmail = u.getEmail() != null && u.getEmail().toLowerCase().contains(q);
                        boolean matchPhone = u.getPhone() != null && u.getPhone().contains(q);
                        if (!matchName && !matchEmail && !matchPhone) return false;
                    }
                    if (StringUtils.hasText(roleFilter) && !"ALL".equalsIgnoreCase(roleFilter)) {
                        Set<String> userRoles = rolesByUserId.getOrDefault(u.getId(), Set.of());
                        if (!userRoles.contains(roleFilter.toUpperCase())) return false;
                    }
                    if (StringUtils.hasText(statusFilter) && !"ALL".equalsIgnoreCase(statusFilter)) {
                        if (u.getAccountStatus() == null || !u.getAccountStatus().name().equalsIgnoreCase(statusFilter)) {
                            return false;
                        }
                    }
                    return true;
                })
                .map(u -> {
                    Set<String> roles = rolesByUserId.getOrDefault(u.getId(), Set.of());
                    TutorApplication app = appByUserId.get(u.getId());
                    return toAdminResponse(u, roles, app);
                })
                .toList();
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
    public AdminUserResponse updateUserStatus(Long userId, AccountStatus status) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        user.setAccountStatus(status);
        User saved = userRepository.save(user);

        Set<String> roles = userRoleRepository.findByUserId(userId).stream()
                .map(ur -> ur.getRole().name())
                .collect(Collectors.toSet());

        TutorApplication app = tutorApplicationRepository.findByUserId(userId).orElse(null);
        return toAdminResponse(saved, roles, app);
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
