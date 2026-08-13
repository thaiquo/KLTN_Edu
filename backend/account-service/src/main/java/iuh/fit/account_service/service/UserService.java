package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.user.ChangePasswordRequest;
import iuh.fit.account_service.dto.user.UpdateUserProfileRequest;
import iuh.fit.account_service.dto.user.UserProfileResponse;
import iuh.fit.account_service.config.FilePolicyProperties;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.FileValidationException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.exception.StorageException;
import iuh.fit.account_service.repository.AdministrativeCommuneRepository;
import iuh.fit.account_service.repository.AdministrativeProvinceRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import iuh.fit.account_service.service.storage.FileStorageService;
import iuh.fit.account_service.util.EmailNormalizer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Locale;
import java.util.List;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final FileStorageService fileStorageService;
    private final FilePolicyProperties filePolicyProperties;
    private final AdministrativeProvinceRepository provinceRepository;
    private final AdministrativeCommuneRepository communeRepository;

    public UserService(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            PasswordEncoder passwordEncoder
    ) {
        this(userRepository, userRoleRepository, passwordEncoder, null, null, null, null);
    }

    public UserService(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            PasswordEncoder passwordEncoder,
            FileStorageService fileStorageService,
            FilePolicyProperties filePolicyProperties
    ) {
        this(userRepository, userRoleRepository, passwordEncoder, fileStorageService, filePolicyProperties, null, null);
    }

    @Autowired
    public UserService(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            PasswordEncoder passwordEncoder,
            FileStorageService fileStorageService,
            FilePolicyProperties filePolicyProperties,
            @Autowired(required = false) AdministrativeProvinceRepository provinceRepository,
            @Autowired(required = false) AdministrativeCommuneRepository communeRepository
    ) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.passwordEncoder = passwordEncoder;
        this.fileStorageService = fileStorageService;
        this.filePolicyProperties = filePolicyProperties;
        this.provinceRepository = provinceRepository;
        this.communeRepository = communeRepository;
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getCurrentUserProfile(String authenticatedEmail) {
        User user = findCurrentUser(authenticatedEmail);
        return toProfileResponse(user);
    }

    @Transactional
    public UserProfileResponse updateCurrentUserProfile(
            String authenticatedEmail,
            UpdateUserProfileRequest request
    ) {
        User user = findCurrentUser(authenticatedEmail);
        user.setFullName(request.getFullName().trim());
        user.setPhone(normalizeOptional(request.getPhone()));
        user.setDateOfBirth(request.getDateOfBirth());
        user.setGender(normalizeOptional(request.getGender()));
        applyStructuredAddress(user, request);
        user.setAddressDetail(normalizeOptional(request.getAddressDetail()));
        user.setBio(normalizeOptional(request.getBio()));

        return toProfileResponse(userRepository.save(user));
    }

    @Transactional
    public UserProfileResponse updateCurrentUserAvatar(String authenticatedEmail, MultipartFile file) {
        User user = findCurrentUser(authenticatedEmail);
        byte[] content = validateAvatar(file);
        String extension = getExtension(file.getOriginalFilename());
        String fileKey = "avatars/" + user.getId() + "/" + UUID.randomUUID() + "." + extension;

        fileStorageService.store(fileKey, content, normalizeContentType(file.getContentType()));
        user.setAvatarKey(fileKey);

        return toProfileResponse(userRepository.save(user));
    }

    @Transactional
    public void changePassword(String authenticatedEmail, ChangePasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BadRequestException("Passwords do not match");
        }

        User user = findCurrentUser(authenticatedEmail);

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new BadRequestException("Current password is incorrect");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    private User findCurrentUser(String authenticatedEmail) {
        String normalizedEmail = EmailNormalizer.normalize(authenticatedEmail);

        return userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Current user was not found"));
    }

    private UserProfileResponse toProfileResponse(User user) {
        List<String> roles = userRoleRepository.findByUserId(user.getId())
                .stream()
                .map(UserRole::getRole)
                .map(Enum::name)
                .toList();

        return new UserProfileResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getDateOfBirth(),
                user.getAvatarKey(),
                resolveAvatarUrl(user.getAvatarKey()),
                user.getGender(),
                user.getProvinceCode(),
                user.getProvince(),
                user.getCommuneCode(),
                user.getCommune(),
                user.getDistrict(),
                user.getWard(),
                user.getAddressDetail(),
                user.getBio(),
                user.isEmailVerified(),
                user.getAccountStatus(),
                roles,
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }

    private byte[] validateAvatar(MultipartFile file) {
        if (fileStorageService == null || filePolicyProperties == null) {
            throw new StorageException("File storage is not configured");
        }

        if (file == null || file.isEmpty()) {
            throw new FileValidationException("Avatar file is required");
        }

        FilePolicyProperties.FileRule policy = filePolicyProperties.getAvatar();
        if (file.getSize() > policy.getMaxSize().toBytes()) {
            throw new FileValidationException("Avatar file is too large");
        }

        String contentType = normalizeContentType(file.getContentType());
        if (!policy.getAllowedContentTypes().isEmpty()
                && !policy.getAllowedContentTypes().contains(contentType)) {
            throw new FileValidationException("Avatar file type is not allowed");
        }

        String extension = getExtension(file.getOriginalFilename());
        if (!StringUtils.hasText(extension)) {
            throw new FileValidationException("Avatar file extension is required");
        }

        if (!policy.getAllowedExtensions().isEmpty()
                && !policy.getAllowedExtensions().contains(extension)) {
            throw new FileValidationException("Avatar file extension is not allowed");
        }

        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException ex) {
            throw new FileValidationException("Could not read avatar file");
        }

        if (!hasAllowedImageSignature(content, contentType)) {
            throw new FileValidationException("Avatar file content does not match an allowed image format");
        }

        return content;
    }

    private String resolveAvatarUrl(String avatarKey) {
        if (fileStorageService == null || !StringUtils.hasText(avatarKey)) {
            return null;
        }

        try {
            return fileStorageService.createPresignedGetUrl(avatarKey);
        } catch (StorageException ex) {
            return null;
        }
    }

    private boolean hasAllowedImageSignature(byte[] content, String contentType) {
        if (content.length < 4) {
            return false;
        }

        if ("image/jpeg".equals(contentType)) {
            return (content[0] & 0xFF) == 0xFF
                    && (content[1] & 0xFF) == 0xD8
                    && (content[2] & 0xFF) == 0xFF;
        }

        if ("image/png".equals(contentType)) {
            return content.length >= 8
                    && (content[0] & 0xFF) == 0x89
                    && content[1] == 0x50
                    && content[2] == 0x4E
                    && content[3] == 0x47;
        }

        if ("image/webp".equals(contentType)) {
            return content.length >= 12
                    && content[0] == 0x52
                    && content[1] == 0x49
                    && content[2] == 0x46
                    && content[3] == 0x46
                    && content[8] == 0x57
                    && content[9] == 0x45
                    && content[10] == 0x42
                    && content[11] == 0x50;
        }

        return false;
    }

    private String getExtension(String filename) {
        if (!StringUtils.hasText(filename) || !filename.contains(".")) {
            return "";
        }

        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    private String normalizeContentType(String contentType) {
        return StringUtils.hasText(contentType)
                ? contentType.trim().toLowerCase(Locale.ROOT)
                : "";
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        return normalized.isBlank() ? null : normalized;
    }

    private void applyStructuredAddress(User user, UpdateUserProfileRequest request) {
        String provinceCode = normalizeOptional(request.getProvinceCode());
        String communeCode = normalizeOptional(request.getCommuneCode());

        if (!StringUtils.hasText(provinceCode) && !StringUtils.hasText(communeCode)) {
            user.setProvinceCode(null);
            user.setProvince(null);
            user.setCommuneCode(null);
            user.setCommune(null);
            user.setDistrict(null);
            user.setWard(null);
            return;
        }

        if (!StringUtils.hasText(provinceCode)) {
            throw new BadRequestException("Province is required when commune is selected");
        }

        if (provinceRepository == null || communeRepository == null) {
            throw new BadRequestException("Administrative reference data is not configured");
        }

        var province = provinceRepository.findByCodeAndActiveTrue(provinceCode)
                .orElseThrow(() -> new BadRequestException("Province is invalid"));
        user.setProvinceCode(province.getCode());
        user.setProvince(province.getName());

        if (!StringUtils.hasText(communeCode)) {
            user.setCommuneCode(null);
            user.setCommune(null);
            user.setDistrict(null);
            user.setWard(null);
            return;
        }

        var commune = communeRepository.findByCodeAndActiveTrue(communeCode)
                .orElseThrow(() -> new BadRequestException("Commune is invalid"));
        if (!province.getCode().equals(commune.getProvince().getCode())) {
            throw new BadRequestException("Commune does not belong to selected province");
        }

        user.setCommuneCode(commune.getCode());
        user.setCommune(commune.getName());
        user.setWard(commune.getName());
        user.setDistrict(null);
    }
}
