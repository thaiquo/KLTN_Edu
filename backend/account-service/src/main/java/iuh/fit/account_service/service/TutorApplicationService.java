package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.tutorapplication.TutorApplicationResponse;
import iuh.fit.account_service.dto.tutorapplication.UpdateTutorApplicationRequest;
import iuh.fit.account_service.entity.TutorApplicationSubject;
import iuh.fit.account_service.entity.TutorDocument;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.enums.TutorDocumentType;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.IncompleteTutorApplicationException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorApplicationSubjectRepository;
import iuh.fit.account_service.repository.TutorDocumentRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.messaging.AccountEventPublisher;
import iuh.fit.account_service.messaging.event.TutorApplicationSubmittedEvent;
import iuh.fit.account_service.util.EmailNormalizer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class TutorApplicationService {

    private final TutorApplicationRepository tutorApplicationRepository;
    private final TutorApplicationSubjectRepository tutorApplicationSubjectRepository;
    private final TutorDocumentRepository tutorDocumentRepository;
    private final UserRepository userRepository;
    private final AccountEventPublisher eventPublisher;

    public TutorApplicationService(
            TutorApplicationRepository tutorApplicationRepository,
            TutorApplicationSubjectRepository tutorApplicationSubjectRepository,
            TutorDocumentRepository tutorDocumentRepository,
            UserRepository userRepository,
            AccountEventPublisher eventPublisher
    ) {
        this.tutorApplicationRepository = tutorApplicationRepository;
        this.tutorApplicationSubjectRepository = tutorApplicationSubjectRepository;
        this.tutorDocumentRepository = tutorDocumentRepository;
        this.userRepository = userRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public TutorApplicationResponse getMyApplication(String email) {
        User user = getCurrentUser(email);
        TutorApplication application = tutorApplicationRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Tutor application not found"));

        return toResponse(application);
    }

    @Transactional
    public TutorApplicationResponse createMyApplication(String email) {
        User user = getCurrentUser(email);

        if (tutorApplicationRepository.existsByUserId(user.getId())) {
            throw new ConflictException("Tutor application already exists");
        }

        TutorApplication application = new TutorApplication();
        application.setUser(user);
        application.setStatus(TutorApplicationStatus.DRAFT);

        TutorApplication saved = tutorApplicationRepository.save(application);
        eventPublisher.publishTutorApplicationSubmitted(new TutorApplicationSubmittedEvent(
                UUID.randomUUID().toString(),
                saved.getId(),
                user.getId(),
                LocalDateTime.now()
        ));
        return toResponse(saved);
    }

    @Transactional
    public TutorApplicationResponse submitMyApplication(String email) {
        User user = getCurrentUser(email);
        TutorApplication application = tutorApplicationRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Tutor application not found"));

        ensureEditable(application);

        List<TutorApplicationSubject> subjects = tutorApplicationSubjectRepository
                .findByTutorApplication_IdOrderByCreatedAtAsc(application.getId());
        List<TutorDocument> documents = tutorDocumentRepository
                .findByTutorApplication_IdOrderByUploadedAtDesc(application.getId());
        List<String> missingItems = validateCompleteness(user, application, subjects, documents);

        if (!missingItems.isEmpty()) {
            throw new IncompleteTutorApplicationException(missingItems);
        }

        snapshotApplicant(user, application);
        application.setStatus(TutorApplicationStatus.PENDING);
        application.setSubmittedAt(LocalDateTime.now());
        application.setReviewedAt(null);
        application.setReviewedBy(null);
        application.setRejectionReason(null);
        application.setReviewNote(null);

        return toResponse(tutorApplicationRepository.save(application));
    }

    @Transactional
    public TutorApplicationResponse updateMyApplication(String email, UpdateTutorApplicationRequest request) {
        User user = getCurrentUser(email);
        TutorApplication application = tutorApplicationRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Tutor application not found"));

        ensureEditable(application);

        if (request.getBio() != null) {
            application.setBio(normalizeText(request.getBio()));
        }
        if (request.getEducationLevel() != null) {
            application.setEducationLevel(normalizeText(request.getEducationLevel()));
        }
        if (request.getInstitution() != null) {
            application.setInstitution(normalizeText(request.getInstitution()));
        }
        if (request.getMajor() != null) {
            application.setMajor(normalizeText(request.getMajor()));
        }
        if (request.getExperienceSummary() != null) {
            application.setExperienceSummary(normalizeText(request.getExperienceSummary()));
        }

        return toResponse(tutorApplicationRepository.save(application));
    }

    public TutorApplicationResponse toResponse(TutorApplication application) {
        return new TutorApplicationResponse(
                application.getId(),
                application.getStatus(),
                application.getBio(),
                application.getEducationLevel(),
                application.getInstitution(),
                application.getMajor(),
                application.getExperienceSummary(),
                application.getSubmittedAt(),
                application.getReviewedAt(),
                application.getRejectionReason(),
                application.getReviewNote(),
                application.getCreatedAt(),
                application.getUpdatedAt()
        );
    }

    private User getCurrentUser(String email) {
        String normalizedEmail = EmailNormalizer.normalize(email);
        return userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private void ensureEditable(TutorApplication application) {
        if (application.getStatus() != TutorApplicationStatus.DRAFT
                && application.getStatus() != TutorApplicationStatus.REJECTED) {
            throw new ConflictException("Tutor application is not editable in current status");
        }
    }

    private List<String> validateCompleteness(
            User user,
            TutorApplication application,
            List<TutorApplicationSubject> subjects,
            List<TutorDocument> documents
    ) {
        List<String> missingItems = new ArrayList<>();

        if (!StringUtils.hasText(user.getFullName())) {
            missingItems.add("accountFullName");
        }
        if (!StringUtils.hasText(user.getEmail())) {
            missingItems.add("accountEmail");
        }
        if (!user.isEmailVerified()) {
            missingItems.add("emailVerified");
        }
        if (!StringUtils.hasText(user.getAvatarKey())) {
            missingItems.add("profilePhoto");
        }
        if (!StringUtils.hasText(application.getEducationLevel())) {
            missingItems.add("educationLevel");
        }
        if (!StringUtils.hasText(application.getInstitution())) {
            missingItems.add("institution");
        }
        if (!StringUtils.hasText(application.getExperienceSummary())) {
            missingItems.add("experienceSummary");
        }
        if (!StringUtils.hasText(application.getBio())) {
            missingItems.add("bio");
        }
        if (subjects == null || subjects.isEmpty()) {
            missingItems.add("teachingSubjects");
        } else if (subjects.stream().anyMatch(this::invalidSubject)) {
            missingItems.add("validTeachingSubjects");
        }
        if (!hasIdentityDocument(documents)) {
            missingItems.add("identityDocument");
        }
        if (!hasCertificateOrDegree(documents)) {
            missingItems.add("degreeOrCertificate");
        }

        return missingItems;
    }

    private boolean invalidSubject(TutorApplicationSubject subject) {
        return subject.getSubjectId() == null
                || !StringUtils.hasText(subject.getSubjectName())
                || subject.getOneToOneHourlyRate() == null
                || subject.getOneToOneHourlyRate().compareTo(BigDecimal.ZERO) <= 0
                || subject.getExperienceYears() == null
                || subject.getExperienceYears() < 0
                || subject.getLevels() == null
                || subject.getLevels().isEmpty();
    }

    private boolean hasIdentityDocument(List<TutorDocument> documents) {
        Set<TutorDocumentType> types = documentTypes(documents);
        return types.contains(TutorDocumentType.PASSPORT)
                || (types.contains(TutorDocumentType.IDENTITY_FRONT)
                && types.contains(TutorDocumentType.IDENTITY_BACK));
    }

    private boolean hasCertificateOrDegree(List<TutorDocument> documents) {
        if (documents == null) {
            return false;
        }

        return documents.stream()
                .filter(document -> document.getDocumentType() == TutorDocumentType.DEGREE
                        || document.getDocumentType() == TutorDocumentType.CERTIFICATE)
                .anyMatch(document -> document.getDocumentType() == TutorDocumentType.DEGREE || !isExpired(document));
    }

    private boolean isExpired(TutorDocument document) {
        return document.getExpiryDate() != null && document.getExpiryDate().isBefore(LocalDate.now());
    }

    private Set<TutorDocumentType> documentTypes(List<TutorDocument> documents) {
        if (documents == null) {
            return Set.of();
        }

        return documents.stream()
                .map(TutorDocument::getDocumentType)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
    }

    private String normalizeText(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void snapshotApplicant(User user, TutorApplication application) {
        application.setApplicantFullName(user.getFullName());
        application.setApplicantEmail(user.getEmail());
        application.setApplicantPhone(user.getPhone());
        application.setApplicantDateOfBirth(user.getDateOfBirth());
        application.setApplicantGender(user.getGender());
        application.setApplicantProvinceCode(user.getProvinceCode());
        application.setApplicantProvinceName(user.getProvince());
        application.setApplicantCommuneCode(user.getCommuneCode());
        application.setApplicantCommuneName(StringUtils.hasText(user.getCommune()) ? user.getCommune() : user.getWard());
        application.setApplicantAddressDetail(user.getAddressDetail());
        application.setApplicantAvatarKey(user.getAvatarKey());
    }
}
