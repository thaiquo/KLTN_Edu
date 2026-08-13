package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.staff.StaffRejectTutorApplicationRequest;
import iuh.fit.account_service.dto.staff.StaffReviewNoteRequest;
import iuh.fit.account_service.dto.staff.StaffTutorApplicationDetailResponse;
import iuh.fit.account_service.dto.staff.StaffTutorApplicationSummaryResponse;
import iuh.fit.account_service.dto.tutorapplication.TutorDocumentDownloadResponse;
import iuh.fit.account_service.entity.Subject;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.TutorApplicationSubject;
import iuh.fit.account_service.entity.TutorDocument;
import iuh.fit.account_service.entity.TutorProfile;
import iuh.fit.account_service.entity.TutorSubject;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.enums.TutorDocumentType;
import iuh.fit.account_service.enums.TutorDocumentVerificationStatus;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.IncompleteTutorApplicationException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorApplicationSubjectRepository;
import iuh.fit.account_service.repository.TutorDocumentRepository;
import iuh.fit.account_service.repository.TutorProfileRepository;
import iuh.fit.account_service.repository.TutorSubjectRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import iuh.fit.account_service.service.storage.FileStorageService;
import iuh.fit.account_service.util.EmailNormalizer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class TutorApprovalService {

    private final TutorApplicationRepository tutorApplicationRepository;
    private final TutorApplicationSubjectRepository tutorApplicationSubjectRepository;
    private final TutorDocumentRepository tutorDocumentRepository;
    private final TutorProfileRepository tutorProfileRepository;
    private final TutorSubjectRepository tutorSubjectRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    public TutorApprovalService(
            TutorApplicationRepository tutorApplicationRepository,
            TutorApplicationSubjectRepository tutorApplicationSubjectRepository,
            TutorDocumentRepository tutorDocumentRepository,
            TutorProfileRepository tutorProfileRepository,
            TutorSubjectRepository tutorSubjectRepository,
            UserRoleRepository userRoleRepository,
            UserRepository userRepository,
            FileStorageService fileStorageService
    ) {
        this.tutorApplicationRepository = tutorApplicationRepository;
        this.tutorApplicationSubjectRepository = tutorApplicationSubjectRepository;
        this.tutorDocumentRepository = tutorDocumentRepository;
        this.tutorProfileRepository = tutorProfileRepository;
        this.tutorSubjectRepository = tutorSubjectRepository;
        this.userRoleRepository = userRoleRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
    }

    @Transactional(readOnly = true)
    public List<StaffTutorApplicationSummaryResponse> listPendingApplications() {
        return tutorApplicationRepository.findByStatus(TutorApplicationStatus.PENDING)
                .stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public StaffTutorApplicationDetailResponse getApplicationDetail(Long applicationId) {
        TutorApplication application = getApplication(applicationId);
        return toDetail(application);
    }

    @Transactional(readOnly = true)
    public TutorDocumentDownloadResponse createDocumentDownloadUrl(Long applicationId, Long documentId) {
        TutorDocument document = tutorDocumentRepository.findByIdAndTutorApplication_Id(documentId, applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Tutor document not found"));
        return new TutorDocumentDownloadResponse(fileStorageService.createPresignedGetUrl(document.getFileKey()));
    }

    @Transactional
    public StaffTutorApplicationDetailResponse approve(Long applicationId, String reviewerEmail, StaffReviewNoteRequest request) {
        TutorApplication application = getApplication(applicationId);
        ensurePending(application);
        User reviewer = getReviewer(reviewerEmail);
        User applicant = application.getUser();
        List<TutorApplicationSubject> applicationSubjects = tutorApplicationSubjectRepository
                .findByTutorApplication_IdOrderByCreatedAtAsc(application.getId());
        List<TutorDocument> documents = tutorDocumentRepository
                .findByTutorApplication_IdOrderByUploadedAtDesc(application.getId());

        List<String> missingItems = validateCompleteness(applicant, application, applicationSubjects, documents);
        if (!missingItems.isEmpty()) {
            throw new IncompleteTutorApplicationException(missingItems);
        }

        ensureTutorRole(applicant);
        TutorProfile profile = getOrCreateProfile(applicant);
        profile.setActive(true);
        profile.setBio(application.getBio());
        profile = tutorProfileRepository.save(profile);
        upsertTutorSubjects(profile, applicationSubjects);
        markDocumentsVerified(documents);

        application.setStatus(TutorApplicationStatus.APPROVED);
        application.setReviewedBy(reviewer);
        application.setReviewedAt(LocalDateTime.now());
        application.setRejectionReason(null);
        application.setReviewNote(normalize(request == null ? null : request.getNote()));

        tutorApplicationRepository.save(application);
        return toDetail(application);
    }

    @Transactional
    public StaffTutorApplicationDetailResponse reject(Long applicationId, String reviewerEmail, StaffRejectTutorApplicationRequest request) {
        TutorApplication application = getApplication(applicationId);
        ensurePending(application);
        User reviewer = getReviewer(reviewerEmail);

        application.setStatus(TutorApplicationStatus.REJECTED);
        application.setReviewedBy(reviewer);
        application.setReviewedAt(LocalDateTime.now());
        application.setRejectionReason(normalize(request.getReason()));
        application.setReviewNote(normalize(request.getNote()));

        tutorApplicationRepository.save(application);
        return toDetail(application);
    }

    private void upsertTutorSubjects(TutorProfile profile, List<TutorApplicationSubject> applicationSubjects) {
        List<TutorSubject> existingSubjects = tutorSubjectRepository.findByTutorProfile_IdOrderByCreatedAtAsc(profile.getId());
        Map<Long, TutorSubject> existingBySubjectId = existingSubjects.stream()
                .collect(Collectors.toMap(item -> item.getSubject().getId(), Function.identity()));
        Set<Long> approvedSubjectIds = applicationSubjects.stream()
                .map(item -> item.getSubject().getId())
                .collect(Collectors.toSet());
        List<TutorSubject> toSave = new ArrayList<>();

        for (TutorApplicationSubject applicationSubject : applicationSubjects) {
            Long subjectId = applicationSubject.getSubject().getId();
            TutorSubject tutorSubject = existingBySubjectId.getOrDefault(subjectId, new TutorSubject());
            tutorSubject.setTutorProfile(profile);
            tutorSubject.setSubject(applicationSubject.getSubject());
            tutorSubject.setOneToOneHourlyRate(applicationSubject.getOneToOneHourlyRate());
            tutorSubject.setExperienceYears(applicationSubject.getExperienceYears());
            tutorSubject.setDescription(applicationSubject.getDescription());
            tutorSubject.setLevels(new java.util.LinkedHashSet<>(applicationSubject.getLevels()));
            tutorSubject.setActive(true);
            toSave.add(tutorSubject);
        }

        for (TutorSubject existingSubject : existingSubjects) {
            if (!approvedSubjectIds.contains(existingSubject.getSubject().getId())) {
                existingSubject.setActive(false);
                toSave.add(existingSubject);
            }
        }

        tutorSubjectRepository.saveAll(toSave);
    }

    private void ensureTutorRole(User applicant) {
        if (userRoleRepository.existsByUserIdAndRole(applicant.getId(), Role.TUTOR)) {
            return;
        }
        UserRole role = new UserRole();
        role.setUser(applicant);
        role.setRole(Role.TUTOR);
        userRoleRepository.save(role);
    }

    private TutorProfile getOrCreateProfile(User applicant) {
        return tutorProfileRepository.findByUserId(applicant.getId())
                .orElseGet(() -> {
                    TutorProfile profile = new TutorProfile();
                    profile.setUser(applicant);
                    return profile;
                });
    }

    private void markDocumentsVerified(List<TutorDocument> documents) {
        for (TutorDocument document : documents) {
            if (document.getVerificationStatus() == TutorDocumentVerificationStatus.PENDING) {
                document.setVerificationStatus(TutorDocumentVerificationStatus.VERIFIED);
            }
        }
        tutorDocumentRepository.saveAll(documents);
    }

    private StaffTutorApplicationSummaryResponse toSummary(TutorApplication application) {
        User user = application.getUser();
        return new StaffTutorApplicationSummaryResponse(
                application.getId(),
                user.getId(),
                firstText(application.getApplicantFullName(), user.getFullName()),
                firstText(application.getApplicantEmail(), user.getEmail()),
                application.getSubmittedAt(),
                application.getStatus(),
                tutorApplicationSubjectRepository.countByTutorApplication_Id(application.getId()),
                tutorDocumentRepository.countByTutorApplication_Id(application.getId()),
                application.getEducationLevel(),
                application.getInstitution()
        );
    }

    private StaffTutorApplicationDetailResponse toDetail(TutorApplication application) {
        User applicant = application.getUser();
        List<StaffTutorApplicationDetailResponse.SubjectItem> subjects = tutorApplicationSubjectRepository
                .findByTutorApplication_IdOrderByCreatedAtAsc(application.getId())
                .stream()
                .map(this::toSubjectItem)
                .toList();
        List<StaffTutorApplicationDetailResponse.DocumentItem> documents = tutorDocumentRepository
                .findByTutorApplication_IdOrderByUploadedAtDesc(application.getId())
                .stream()
                .map(this::toDocumentItem)
                .toList();

        return new StaffTutorApplicationDetailResponse(
                new StaffTutorApplicationDetailResponse.Applicant(
                        applicant.getId(),
                        firstText(application.getApplicantFullName(), applicant.getFullName()),
                        firstText(application.getApplicantEmail(), applicant.getEmail()),
                        firstText(application.getApplicantPhone(), applicant.getPhone()),
                        application.getApplicantDateOfBirth() != null ? application.getApplicantDateOfBirth() : applicant.getDateOfBirth(),
                        firstText(application.getApplicantGender(), applicant.getGender()),
                        firstText(application.getApplicantProvinceName(), applicant.getProvince()),
                        firstText(application.getApplicantCommuneName(), firstText(applicant.getCommune(), applicant.getWard())),
                        firstText(application.getApplicantAddressDetail(), applicant.getAddressDetail()),
                        applicant.getAccountStatus(),
                        resolveAvatarUrl(firstText(application.getApplicantAvatarKey(), applicant.getAvatarKey()))
                ),
                new StaffTutorApplicationDetailResponse.Application(
                        application.getId(),
                        application.getStatus(),
                        application.getEducationLevel(),
                        application.getInstitution(),
                        application.getMajor(),
                        application.getExperienceSummary(),
                        application.getBio(),
                        application.getSubmittedAt(),
                        application.getReviewedAt(),
                        application.getReviewedBy() == null ? null : application.getReviewedBy().getFullName(),
                        application.getRejectionReason(),
                        application.getReviewNote()
                ),
                subjects,
                documents
        );
    }

    private StaffTutorApplicationDetailResponse.SubjectItem toSubjectItem(TutorApplicationSubject item) {
        Subject subject = item.getSubject();
        return new StaffTutorApplicationDetailResponse.SubjectItem(
                item.getId(),
                subject.getId(),
                subject.getName(),
                subject.getCategory() == null ? null : subject.getCategory().getName(),
                subject.getGroup() == null ? null : subject.getGroup().getName(),
                item.getOneToOneHourlyRate(),
                item.getExperienceYears(),
                item.getDescription(),
                item.getLevels()
        );
    }

    private StaffTutorApplicationDetailResponse.DocumentItem toDocumentItem(TutorDocument document) {
        return new StaffTutorApplicationDetailResponse.DocumentItem(
                document.getId(),
                document.getDocumentType(),
                document.getOriginalFilename(),
                document.getContentType(),
                document.getFileSize(),
                document.getVerificationStatus(),
                document.getTitle(),
                document.getIssuer(),
                document.getIssueDate(),
                document.getValidityType(),
                document.getExpiryDate(),
                document.getCredentialNumber(),
                document.getExpiryDate() != null && document.getExpiryDate().isBefore(LocalDate.now())
        );
    }

    private String resolveAvatarUrl(String avatarKey) {
        if (!StringUtils.hasText(avatarKey)) {
            return null;
        }
        try {
            return fileStorageService.createPresignedGetUrl(avatarKey);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private List<String> validateCompleteness(User user, TutorApplication application, List<TutorApplicationSubject> subjects, List<TutorDocument> documents) {
        List<String> missingItems = new ArrayList<>();
        if (!StringUtils.hasText(firstText(application.getApplicantFullName(), user.getFullName()))) missingItems.add("accountFullName");
        if (!StringUtils.hasText(firstText(application.getApplicantEmail(), user.getEmail()))) missingItems.add("accountEmail");
        if (!user.isEmailVerified()) missingItems.add("emailVerified");
        if (!StringUtils.hasText(firstText(application.getApplicantAvatarKey(), user.getAvatarKey()))) missingItems.add("profilePhoto");
        if (!StringUtils.hasText(application.getEducationLevel())) missingItems.add("educationLevel");
        if (!StringUtils.hasText(application.getInstitution())) missingItems.add("institution");
        if (!StringUtils.hasText(application.getExperienceSummary())) missingItems.add("experienceSummary");
        if (!StringUtils.hasText(application.getBio())) missingItems.add("bio");
        if (subjects == null || subjects.isEmpty()) {
            missingItems.add("teachingSubjects");
        } else if (subjects.stream().anyMatch(this::invalidSubject)) {
            missingItems.add("validTeachingSubjects");
        }
        if (!hasIdentityDocument(documents)) missingItems.add("identityDocument");
        if (!hasCertificateOrDegree(documents)) missingItems.add("degreeOrCertificate");
        return missingItems;
    }

    private boolean invalidSubject(TutorApplicationSubject subject) {
        return subject.getSubject() == null
                || !subject.getSubject().isActive()
                || subject.getOneToOneHourlyRate() == null
                || subject.getOneToOneHourlyRate().compareTo(BigDecimal.ZERO) <= 0
                || subject.getExperienceYears() == null
                || subject.getExperienceYears() < 0
                || subject.getLevels() == null
                || subject.getLevels().isEmpty()
                || !subject.getSubject().getSupportedLevels().containsAll(subject.getLevels());
    }

    private boolean hasIdentityDocument(List<TutorDocument> documents) {
        Set<TutorDocumentType> types = documentTypes(documents);
        return types.contains(TutorDocumentType.PASSPORT)
                || (types.contains(TutorDocumentType.IDENTITY_FRONT) && types.contains(TutorDocumentType.IDENTITY_BACK));
    }

    private boolean hasCertificateOrDegree(List<TutorDocument> documents) {
        if (documents == null) return false;
        return documents.stream()
                .filter(document -> document.getDocumentType() == TutorDocumentType.DEGREE
                        || document.getDocumentType() == TutorDocumentType.CERTIFICATE)
                .anyMatch(document -> document.getDocumentType() == TutorDocumentType.DEGREE
                        || document.getExpiryDate() == null
                        || !document.getExpiryDate().isBefore(LocalDate.now()));
    }

    private Set<TutorDocumentType> documentTypes(List<TutorDocument> documents) {
        if (documents == null) return Set.of();
        return documents.stream().map(TutorDocument::getDocumentType).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
    }

    private TutorApplication getApplication(Long applicationId) {
        return tutorApplicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Tutor application not found"));
    }

    private User getReviewer(String email) {
        return userRepository.findByEmailIgnoreCase(EmailNormalizer.normalize(email))
                .orElseThrow(() -> new ResourceNotFoundException("Reviewer not found"));
    }

    private void ensurePending(TutorApplication application) {
        if (application.getStatus() != TutorApplicationStatus.PENDING) {
            throw new ConflictException("Tutor application has already been processed");
        }
    }

    private String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String firstText(String first, String fallback) {
        return StringUtils.hasText(first) ? first : fallback;
    }
}
