package iuh.fit.account_service.service;

import iuh.fit.account_service.messaging.event.TutorApprovedEvent;
import iuh.fit.account_service.messaging.event.TutorRejectedEvent;
import iuh.fit.account_service.dto.staff.StaffRejectTutorApplicationRequest;
import iuh.fit.account_service.dto.staff.StaffReviewNoteRequest;
import iuh.fit.account_service.dto.staff.StaffTutorApplicationDetailResponse;
import iuh.fit.account_service.dto.staff.StaffTutorApplicationSummaryResponse;
import iuh.fit.account_service.dto.staff.StaffTutorDocumentAccessResponse;
import iuh.fit.account_service.dto.tutorapplication.TutorDocumentDownloadResponse;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.TutorApplicationSubject;
import iuh.fit.account_service.entity.TutorDocument;
import iuh.fit.account_service.entity.TutorProfile;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.enums.TutorDocumentType;
import iuh.fit.account_service.enums.TutorDocumentVerificationStatus;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.IncompleteTutorApplicationException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.messaging.AccountEventPublisher;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorApplicationSubjectRepository;
import iuh.fit.account_service.repository.TutorDocumentRepository;
import iuh.fit.account_service.repository.TutorProfileRepository;
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
import java.util.UUID;
import java.util.stream.Collectors;
import iuh.fit.account_service.realtime.RealtimeEventHub;

@Service
public class TutorApprovalService {

    private final TutorApplicationRepository tutorApplicationRepository;
    private final TutorApplicationSubjectRepository tutorApplicationSubjectRepository;
    private final TutorDocumentRepository tutorDocumentRepository;
    private final TutorProfileRepository tutorProfileRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final AccountEventPublisher eventPublisher;
    private final RealtimeEventHub realtimeEventHub;

    public TutorApprovalService(
            TutorApplicationRepository tutorApplicationRepository,
            TutorApplicationSubjectRepository tutorApplicationSubjectRepository,
            TutorDocumentRepository tutorDocumentRepository,
            TutorProfileRepository tutorProfileRepository,
            UserRoleRepository userRoleRepository,
            UserRepository userRepository,
            FileStorageService fileStorageService,
            AccountEventPublisher eventPublisher,
            RealtimeEventHub realtimeEventHub
    ) {
        this.tutorApplicationRepository = tutorApplicationRepository;
        this.tutorApplicationSubjectRepository = tutorApplicationSubjectRepository;
        this.tutorDocumentRepository = tutorDocumentRepository;
        this.tutorProfileRepository = tutorProfileRepository;
        this.userRoleRepository = userRoleRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
        this.eventPublisher = eventPublisher;
        this.realtimeEventHub = realtimeEventHub;
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

    @Transactional(readOnly = true)
    public StaffTutorDocumentAccessResponse createDocumentAccess(Long documentId) {
        TutorDocument document = tutorDocumentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Tutor document not found"));
        String contentType = document.getContentType();
        boolean previewable = contentType != null && (
                contentType.startsWith("image/")
                        || "application/pdf".equals(contentType)
                        || contentType.startsWith("text/")
        );
        return new StaffTutorDocumentAccessResponse(
                document.getId(),
                document.getOriginalFilename(),
                contentType,
                document.getFileSize(),
                previewable,
                fileStorageService.createPresignedGetUrl(document.getFileKey())
        );
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
        if (StringUtils.hasText(application.getBio())) {
            profile.setBio(application.getBio());
        }
        profile = tutorProfileRepository.save(profile);
        publishTutorApproved(application, profile, applicationSubjects);
        markDocumentsVerified(documents);

        application.setStatus(TutorApplicationStatus.APPROVED);
        application.setReviewedBy(reviewer);
        application.setReviewedAt(LocalDateTime.now());
        application.setRejectionReason(null);
        application.setReviewNote(normalize(request == null ? null : request.getNote()));

        tutorApplicationRepository.save(application);
        publishReviewRealtime(application, "APPROVED");
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

        // Delete rejected files from S3 to free up storage, while recording rejection status
        List<TutorDocument> documents = tutorDocumentRepository
                .findByTutorApplication_IdOrderByUploadedAtDesc(application.getId());
        for (TutorDocument doc : documents) {
            if (doc.getVerificationStatus() == TutorDocumentVerificationStatus.PENDING) {
                if (StringUtils.hasText(doc.getFileKey())) {
                    try {
                        fileStorageService.delete(doc.getFileKey());
                    } catch (RuntimeException ignored) {}
                }
                doc.setVerificationStatus(TutorDocumentVerificationStatus.REJECTED);
            }
        }
        tutorDocumentRepository.saveAll(documents);

        tutorApplicationRepository.save(application);
        try {
            eventPublisher.publishTutorRejected(new TutorRejectedEvent(
                    UUID.randomUUID().toString(),
                    application.getId(),
                    application.getUser().getId(),
                    application.getRejectionReason(),
                    LocalDateTime.now()
            ));
        } catch (Exception ex) {
            System.err.println("Warning: failed to publish TutorRejectedEvent: " + ex.getMessage());
        }
        publishReviewRealtime(application, "REJECTED");
        return toDetail(application);
    }

    private void publishReviewRealtime(TutorApplication application, String status) {
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("userId", application.getUser().getId());
        payload.put("email", application.getUser().getEmail());
        payload.put("status", status);
        payload.put("reason", application.getRejectionReason());
        realtimeEventHub.publishToReviewers("TUTOR_APPLICATION_REVIEWED", application.getId(), payload);
        realtimeEventHub.publishToUser(application.getUser().getEmail(), "TUTOR_APPLICATION_REVIEWED", application.getId(), payload);
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

    @Transactional(readOnly = true)
    public List<StaffTutorApplicationSummaryResponse> listHistory(String currentUserEmail) {
        User currentUser = getReviewer(currentUserEmail);
        List<TutorApplicationStatus> reviewedStatuses = List.of(TutorApplicationStatus.APPROVED, TutorApplicationStatus.REJECTED);

        List<TutorApplication> list;
        if (currentUser != null && userRoleRepository.existsByUserIdAndRole(currentUser.getId(), Role.ADMIN)) {
            // Admin sees all history reviewed across all staff/admins
            list = tutorApplicationRepository.findByStatusInOrderByReviewedAtDesc(reviewedStatuses);
        } else if (currentUser != null) {
            // Staff sees history reviewed by themselves
            list = tutorApplicationRepository.findByReviewedByIdAndStatusInOrderByReviewedAtDesc(currentUser.getId(), reviewedStatuses);
        } else {
            list = List.of();
        }
        return list.stream().map(this::toSummary).toList();
    }

    private StaffTutorApplicationSummaryResponse toSummary(TutorApplication application) {
        User user = application.getUser();
        String fullName = firstText(application.getApplicantFullName(), user.getFullName());
        String email = firstText(application.getApplicantEmail(), user.getEmail());
        String phone = firstText(application.getApplicantPhone(), user.getPhone());
        LocalDate dob = application.getApplicantDateOfBirth() != null ? application.getApplicantDateOfBirth() : user.getDateOfBirth();
        String province = firstText(application.getApplicantProvinceName(), user.getProvince());
        String commune = firstText(application.getApplicantCommuneName(), firstText(user.getCommune(), user.getWard()));
        String avatarUrl = resolveAvatarUrl(firstText(application.getApplicantAvatarKey(), user.getAvatarKey()));

        User reviewer = application.getReviewedBy();
        String reviewedByName = reviewer != null ? reviewer.getFullName() : null;
        String reviewedByEmail = reviewer != null ? reviewer.getEmail() : null;

        return new StaffTutorApplicationSummaryResponse(
                application.getId(),
                user.getId(),
                fullName,
                email,
                phone,
                dob,
                province,
                commune,
                avatarUrl,
                application.getSubmittedAt(),
                application.getReviewedAt(),
                reviewedByName,
                reviewedByEmail,
                application.getRejectionReason(),
                application.getReviewNote(),
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
        return new StaffTutorApplicationDetailResponse.SubjectItem(
                item.getId(),
                item.getSubjectId(),
                item.getSubjectName(),
                item.getSubjectCategoryName(),
                item.getSubjectGroupName(),
                item.getOneToOneHourlyRate(),
                item.getExperienceYears(),
                item.getDescription(),
                item.getLevels()
        );
    }

    private StaffTutorApplicationDetailResponse.DocumentItem toDocumentItem(TutorDocument document) {
        String url = null;
        if (StringUtils.hasText(document.getFileKey())) {
            try {
                url = fileStorageService.createPresignedGetUrl(document.getFileKey());
            } catch (RuntimeException ignored) {}
        }
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
                document.getExpiryDate() != null && document.getExpiryDate().isBefore(LocalDate.now()),
                url
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

    private void publishTutorApproved(TutorApplication application, TutorProfile profile, List<TutorApplicationSubject> subjects) {
        try {
            Set<TutorApprovedEvent.SubjectItem> items = Set.of();
            if (subjects != null && !subjects.isEmpty()) {
                items = subjects.stream()
                        .filter(s -> s != null && s.getSubjectId() != null)
                        .map(subject -> new TutorApprovedEvent.SubjectItem(
                                subject.getSubjectId(),
                                subject.getLevels() != null ? new java.util.LinkedHashSet<>(subject.getLevels()) : Set.of(),
                                subject.getOneToOneHourlyRate() != null ? subject.getOneToOneHourlyRate() : BigDecimal.ZERO,
                                subject.getExperienceYears() != null ? subject.getExperienceYears() : 0,
                                subject.getDescription()
                        ))
                        .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
            }
            eventPublisher.publishTutorApproved(new TutorApprovedEvent(
                    UUID.randomUUID().toString(),
                    application.getId(),
                    profile.getId(),
                    application.getUser().getId(),
                    items,
                    LocalDateTime.now()
            ));
        } catch (Exception ex) {
            System.err.println("Warning: failed to publish TutorApprovedEvent: " + ex.getMessage());
        }
    }

    private List<String> validateCompleteness(User user, TutorApplication application, List<TutorApplicationSubject> subjects, List<TutorDocument> documents) {
        List<String> missingItems = new ArrayList<>();
        if (!StringUtils.hasText(firstText(application.getApplicantFullName(), user.getFullName()))) missingItems.add("accountFullName");
        if (!StringUtils.hasText(firstText(application.getApplicantEmail(), user.getEmail()))) missingItems.add("accountEmail");
        if (!hasIdentityDocument(documents)) missingItems.add("identityDocument");
        return missingItems;
    }

    private boolean hasIdentityDocument(List<TutorDocument> documents) {
        Set<TutorDocumentType> types = documentTypes(documents);
        return types.contains(TutorDocumentType.PASSPORT)
                || (types.contains(TutorDocumentType.IDENTITY_FRONT) && types.contains(TutorDocumentType.IDENTITY_BACK));
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
        if (!StringUtils.hasText(email)) return null;
        return userRepository.findByEmailIgnoreCase(EmailNormalizer.normalize(email))
                .orElse(null);
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
