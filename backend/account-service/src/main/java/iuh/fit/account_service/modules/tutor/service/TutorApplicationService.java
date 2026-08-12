package iuh.fit.account_service.modules.tutor.service;

import iuh.fit.account_service.infrastructure.security.AuthPrincipal;
import iuh.fit.account_service.infrastructure.storage.StoredContent;
import iuh.fit.account_service.infrastructure.storage.TutorCertificateStorageService;
import iuh.fit.account_service.modules.auth.entity.Account;
import iuh.fit.account_service.modules.auth.repository.AccountRepository;
import iuh.fit.account_service.modules.role.entity.RoleEntity;
import iuh.fit.account_service.modules.role.repository.RoleRepository;
import iuh.fit.account_service.modules.tutor.dto.CertificateRequest;
import iuh.fit.account_service.modules.tutor.dto.CertificateResponse;
import iuh.fit.account_service.modules.tutor.dto.TutorApplicationRequest;
import iuh.fit.account_service.modules.tutor.dto.TutorApplicationResponse;
import iuh.fit.account_service.modules.tutor.dto.TeachingSubjectRequest;
import iuh.fit.account_service.modules.tutor.dto.TeachingSubjectResponse;
import iuh.fit.account_service.modules.tutor.dto.TutorApplicationEventResponse;
import iuh.fit.account_service.modules.tutor.entity.Certificate;
import iuh.fit.account_service.modules.tutor.entity.TeachingSubject;
import iuh.fit.account_service.modules.tutor.entity.TutorApplicationEvent;
import iuh.fit.account_service.modules.tutor.repository.TutorApplicationEventRepository;
import iuh.fit.account_service.modules.tutor.realtime.TutorApplicationRealtimeService;
import iuh.fit.account_service.modules.tutor.entity.TutorApplication;
import iuh.fit.account_service.modules.tutor.entity.TutorProfile;
import iuh.fit.account_service.modules.tutor.enums.CertificateVerificationStatus;
import iuh.fit.account_service.modules.tutor.enums.TutorApplicationStatus;
import iuh.fit.account_service.modules.tutor.enums.TutorStatus;
import iuh.fit.account_service.modules.tutor.repository.TutorApplicationRepository;
import iuh.fit.account_service.modules.tutor.repository.CertificateRepository;
import iuh.fit.account_service.modules.tutor.repository.TutorProfileRepository;
import iuh.fit.account_service.shared.enums.Role;
import iuh.fit.account_service.shared.exception.ConflictException;
import iuh.fit.account_service.shared.exception.ForbiddenException;
import iuh.fit.account_service.shared.exception.NotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class TutorApplicationService {

    private final TutorApplicationRepository applicationRepository;
    private final TutorProfileRepository tutorProfileRepository;
    private final AccountRepository accountRepository;
    private final RoleRepository roleRepository;
    private final CertificateRepository certificateRepository;
    private final TutorCertificateStorageService certificateStorage;
    private final TutorApplicationEventRepository eventRepository;
    private final TutorApplicationRealtimeService realtimeService;

    public TutorApplicationService(TutorApplicationRepository applicationRepository,
                                   TutorProfileRepository tutorProfileRepository,
                                   AccountRepository accountRepository,
                                   RoleRepository roleRepository,
                                   CertificateRepository certificateRepository,
                                   TutorCertificateStorageService certificateStorage,
                                   TutorApplicationEventRepository eventRepository,
                                   TutorApplicationRealtimeService realtimeService) {
        this.applicationRepository = applicationRepository;
        this.tutorProfileRepository = tutorProfileRepository;
        this.accountRepository = accountRepository;
        this.roleRepository = roleRepository;
        this.certificateRepository = certificateRepository;
        this.certificateStorage = certificateStorage;
        this.eventRepository = eventRepository;
        this.realtimeService = realtimeService;
    }

    public TutorApplicationResponse create(AuthPrincipal principal, TutorApplicationRequest request) {
        Account user = loadUser(principal.id());
        requireEligibleApplicant(user);

        TutorApplication application = new TutorApplication();
        application.setUser(user);
        application.replaceTeachingSubjects(toTeachingSubjects(request.teachingSubjects(), user.getId()));
        TutorApplication saved = applicationRepository.save(application);
        recordEvent(saved, principal.id(), "DRAFT_CREATED", "Hồ sơ nháp đã được tạo");
        TutorApplicationResponse response = toResponse(saved);
        realtimeService.publish(saved.getUser().getId(), response);
        return response;
    }

    public TutorApplicationResponse update(AuthPrincipal principal, UUID id, TutorApplicationRequest request) {
        TutorApplication application = loadOwnedApplication(id, principal.id());
        if (application.getStatus() != TutorApplicationStatus.DRAFT
            && application.getStatus() != TutorApplicationStatus.REJECTED) {
            throw new ConflictException("Only draft or rejected applications can be updated");
        }
        application.replaceTeachingSubjects(toTeachingSubjects(request.teachingSubjects(), principal.id()));
        application.setRejectionReason(null);
        application.setReviewNote(null);
        application.setReviewedAt(null);
        application.setReviewedBy(null);
        application.setStatus(TutorApplicationStatus.DRAFT);
        TutorApplication saved = applicationRepository.save(application);
        recordEvent(saved, principal.id(), "DRAFT_UPDATED", "Hồ sơ nháp đã được cập nhật");
        TutorApplicationResponse response = toResponse(saved);
        realtimeService.publish(saved.getUser().getId(), response);
        return response;
    }

    @Transactional(readOnly = true)
    public List<TutorApplicationResponse> listMine(AuthPrincipal principal) {
        return applicationRepository.findAllByUser_IdOrderByCreatedAtDesc(principal.id()).stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public CertificateDownload downloadOwnCertificate(AuthPrincipal principal, UUID certificateId) {
        Certificate certificate = certificateRepository.findByIdAndTutorApplication_User_Id(certificateId, principal.id())
            .orElseThrow(() -> new NotFoundException("Certificate not found"));
        return readCertificate(certificate);
    }

    @Transactional(readOnly = true)
    public CertificateDownload downloadForReview(UUID applicationId, UUID certificateId) {
        Certificate certificate = certificateRepository.findByIdAndTutorApplication_Id(certificateId, applicationId)
            .orElseThrow(() -> new NotFoundException("Certificate not found"));
        return readCertificate(certificate);
    }

    public TutorApplicationResponse submit(AuthPrincipal principal, UUID id) {
        TutorApplication application = loadOwnedApplication(id, principal.id());
        if (application.getStatus() != TutorApplicationStatus.DRAFT
            && application.getStatus() != TutorApplicationStatus.REJECTED) {
            throw new ConflictException("Application cannot be submitted from its current status");
        }
        if (application.getTeachingSubjects().isEmpty()
            || application.getTeachingSubjects().stream().anyMatch(subject -> subject.getCertificates().isEmpty())) {
            throw new ConflictException("Cần có ít nhất một môn học và một chứng chỉ cho mỗi môn");
        }
        application.setStatus(TutorApplicationStatus.PENDING);
        application.setSubmittedAt(Instant.now());
        application.setRejectionReason(null);
        application.setReviewNote(null);
        TutorApplication saved = applicationRepository.save(application);
        recordEvent(saved, principal.id(), "SUBMITTED", "Hồ sơ đã được gửi để xét duyệt");
        TutorApplicationResponse response = toResponse(saved);
        realtimeService.publish(saved.getUser().getId(), response);
        return response;
    }

    @Transactional(readOnly = true)
    public Page<TutorApplicationResponse> list(Pageable pageable) {
        return applicationRepository.findAllByOrderByCreatedAtDesc(pageable).map(this::toResponse);
    }

    public TutorApplicationResponse approve(AuthPrincipal reviewer, UUID id, String note) {
        TutorApplication application = loadReviewable(id);
        Account user = application.getUser();

        if (!user.getRoles().contains(Role.TUTOR)) {
            RoleEntity tutorRole = roleRepository.findByName(Role.TUTOR)
                .orElseGet(() -> roleRepository.save(new RoleEntity(Role.TUTOR)));
            user.assignRole(tutorRole, reviewer.id());
            accountRepository.save(user);
        }

        TutorProfile profile = tutorProfileRepository.findByUser_Id(user.getId()).orElseGet(() -> {
            TutorProfile created = new TutorProfile();
            created.setUser(user);
            return created;
        });
        profile.setVerificationStatus(TutorStatus.APPROVED);
        tutorProfileRepository.save(profile);

        application.getTeachingSubjects().stream().flatMap(subject -> subject.getCertificates().stream())
            .forEach(certificate -> certificate.setVerificationStatus(CertificateVerificationStatus.VERIFIED));
        application.setStatus(TutorApplicationStatus.APPROVED);
        application.setReviewedAt(Instant.now());
        application.setReviewedBy(reviewer.id());
        application.setRejectionReason(null);
        application.setReviewNote(note.trim());
        TutorApplication saved = applicationRepository.save(application);
        recordEvent(saved, reviewer.id(), "APPROVED", "Hồ sơ đã được phê duyệt");
        TutorApplicationResponse response = toResponse(saved);
        realtimeService.publish(saved.getUser().getId(), response);
        return response;
    }

    public TutorApplicationResponse reject(AuthPrincipal reviewer, UUID id, String reason) {
        TutorApplication application = loadReviewable(id);
        application.setStatus(TutorApplicationStatus.REJECTED);
        application.setReviewedAt(Instant.now());
        application.setReviewedBy(reviewer.id());
        application.setRejectionReason(reason.trim());
        application.setReviewNote(reason.trim());
        TutorApplication saved = applicationRepository.save(application);
        recordEvent(saved, reviewer.id(), "REJECTED", "Hồ sơ bị từ chối: " + reason.trim());
        TutorApplicationResponse response = toResponse(saved);
        realtimeService.publish(saved.getUser().getId(), response);
        return response;
    }

    private Account loadUser(UUID userId) {
        return accountRepository.findById(userId)
            .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private void requireEligibleApplicant(Account user) {
        if (!user.getRoles().contains(Role.STUDENT) && !user.getRoles().contains(Role.TUTOR)) {
            throw new ForbiddenException("Cần có vai trò học viên hoặc giảng viên để nộp hồ sơ môn học");
        }
    }

    private TutorApplication loadOwnedApplication(UUID id, UUID userId) {
        return applicationRepository.findByIdAndUser_Id(id, userId)
            .orElseThrow(() -> new NotFoundException("Tutor application not found"));
    }

    private TutorApplication loadReviewable(UUID id) {
        TutorApplication application = applicationRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Tutor application not found"));
        if (application.getStatus() != TutorApplicationStatus.PENDING
            && application.getStatus() != TutorApplicationStatus.SUBMITTED
            && application.getStatus() != TutorApplicationStatus.UNDER_REVIEW) {
            throw new ConflictException("Application is not ready for review");
        }
        return application;
    }

    private List<Certificate> toCertificates(List<CertificateRequest> requests, UUID ownerId) {
        if (requests == null) {
            return List.of();
        }
        return requests.stream().map(request -> {
            if (request.expiryDate() != null && request.expiryDate().isBefore(request.issueDate())) {
                throw new ConflictException("Certificate expiry date cannot precede issue date");
            }
            if (!certificateStorage.belongsTo(ownerId, request.fileKey())) {
                throw new ForbiddenException("Certificate file does not belong to this account");
            }
            if (request.fileSize() < 0 || request.fileSize() > 5L * 1024 * 1024) {
                throw new ConflictException("Invalid certificate file size");
            }
            Certificate certificate = new Certificate();
            certificate.setName(request.name().trim());
            certificate.setIssuer(request.issuer().trim());
            certificate.setIssueDate(request.issueDate());
            certificate.setExpiryDate(request.expiryDate());
            certificate.setFileKey(request.fileKey().trim());
            certificate.setFileUrl(certificateStorage.url(request.fileKey().trim()));
            certificate.setOriginalFileName(request.originalFileName().trim());
            certificate.setContentType(request.contentType().trim());
            certificate.setFileSize(request.fileSize());
            return certificate;
        }).toList();
    }

    private List<TeachingSubject> toTeachingSubjects(List<TeachingSubjectRequest> requests, UUID ownerId) {
        if (requests == null || requests.isEmpty()) {
            throw new ConflictException("Cần có ít nhất một môn học");
        }
        return requests.stream().map(request -> {
            TeachingSubject subject = new TeachingSubject();
            subject.setLevelGroup(request.levelGroup().trim());
            subject.setSubjectName(request.subjectName().trim());
            subject.setTeachingLevel(request.teachingLevel().trim());
            subject.setBio(request.bio().trim());
            subject.setExperience(request.experience().trim());
            toCertificates(request.certificates(), ownerId).forEach(subject::addCertificate);
            return subject;
        }).toList();
    }

    private TutorApplicationResponse toResponse(TutorApplication application) {
        List<CertificateResponse> certificates = application.getTeachingSubjects().stream()
            .flatMap(subject -> subject.getCertificates().stream())
            .map(certificate -> new CertificateResponse(
                certificate.getId(),
                certificate.getName(),
                certificate.getIssuer(),
                certificate.getIssueDate(),
                certificate.getExpiryDate(),
                certificate.getFileKey(),
                certificate.getFileUrl(),
                certificate.getOriginalFileName(),
                certificate.getContentType(),
                certificate.getFileSize(),
                "/tutor-applications/certificates/" + certificate.getId() + "/content",
                certificate.getVerificationStatus()
            ))
            .toList();
        List<TeachingSubjectResponse> subjects = application.getTeachingSubjects().stream()
            .map(subject -> new TeachingSubjectResponse(
                subject.getId(), subject.getLevelGroup(), subject.getSubjectName(), subject.getTeachingLevel(),
                subject.getBio(), subject.getExperience(), subject.getCertificates().stream()
                    .map(certificate -> new CertificateResponse(certificate.getId(), certificate.getName(), certificate.getIssuer(),
                        certificate.getIssueDate(), certificate.getExpiryDate(), certificate.getFileKey(), certificate.getFileUrl(), certificate.getOriginalFileName(),
                        certificate.getContentType(), certificate.getFileSize(), "/tutor-applications/certificates/" + certificate.getId() + "/content",
                        certificate.getVerificationStatus()))
                    .toList()))
            .toList();
        List<TutorApplicationEventResponse> events = eventRepository.findByTutorApplication_IdOrderByCreatedAtAsc(application.getId()).stream()
            .map(event -> new TutorApplicationEventResponse(event.getId(), event.getActorId(), event.getEventType(), event.getDetail(), event.getCreatedAt()))
            .toList();
        return new TutorApplicationResponse(
            application.getId(),
            application.getUser().getId(),
            application.getUser().getProfile() == null ? null : application.getUser().getProfile().getFullName(),
            application.getUser().getEmail(),
            application.getStatus(),
            application.getSubmittedAt(),
            application.getReviewedAt(),
            application.getReviewedBy(),
            application.getRejectionReason(),
            application.getReviewNote(),
            certificates,
            subjects,
            events,
            application.getCreatedAt(),
            application.getUpdatedAt()
        );
    }

    private void recordEvent(TutorApplication application, UUID actorId, String type, String detail) {
        TutorApplicationEvent event = new TutorApplicationEvent();
        event.setTutorApplication(application); event.setActorId(actorId); event.setEventType(type); event.setDetail(detail);
        eventRepository.save(event);
    }

    private CertificateDownload readCertificate(Certificate certificate) {
        StoredContent content = certificateStorage.read(certificate.getFileKey());
        return new CertificateDownload(content.bytes(), certificate.getContentType(), certificate.getOriginalFileName());
    }

    public record CertificateDownload(byte[] content, String contentType, String fileName) {
    }
}
