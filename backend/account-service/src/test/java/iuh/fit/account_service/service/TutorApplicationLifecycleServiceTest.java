package iuh.fit.account_service.service;

import iuh.fit.account_service.config.FilePolicyProperties;
import iuh.fit.account_service.dto.tutor.TutorProfileRequest;
import iuh.fit.account_service.dto.tutorapplication.UpdateTutorApplicationRequest;
import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.TutorDocument;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.enums.TutorDocumentType;
import iuh.fit.account_service.enums.TutorStatus;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.messaging.AccountEventPublisher;
import iuh.fit.account_service.realtime.RealtimeEventHub;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorApplicationSubjectRepository;
import iuh.fit.account_service.repository.TutorDocumentRepository;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import iuh.fit.account_service.service.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TutorApplicationLifecycleServiceTest {

    private UserRepository userRepository;
    private UserRoleRepository userRoleRepository;
    private TutorRepository tutorRepository;
    private TutorApplicationRepository tutorApplicationRepository;
    private TutorApplicationSubjectRepository tutorApplicationSubjectRepository;
    private TutorDocumentRepository tutorDocumentRepository;
    private TutorApplicationService tutorApplicationService;
    private TutorDocumentService tutorDocumentService;
    private TutorService tutorService;
    private StaffService staffService;
    private User user;
    private Tutor tutor;
    private TutorApplication application;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        userRoleRepository = mock(UserRoleRepository.class);
        tutorRepository = mock(TutorRepository.class);
        tutorApplicationRepository = mock(TutorApplicationRepository.class);
        tutorApplicationSubjectRepository = mock(TutorApplicationSubjectRepository.class);
        tutorDocumentRepository = mock(TutorDocumentRepository.class);

        tutorApplicationService = new TutorApplicationService(
                tutorApplicationRepository,
                tutorApplicationSubjectRepository,
                tutorDocumentRepository,
                userRepository,
                userRoleRepository,
                tutorRepository,
                mock(AccountEventPublisher.class),
                mock(RealtimeEventHub.class)
        );

        tutorDocumentService = new TutorDocumentService(
                tutorApplicationRepository,
                tutorDocumentRepository,
                tutorRepository,
                userRepository,
                mock(FileStorageService.class),
                mock(FilePolicyProperties.class)
        );

        tutorService = new TutorService(
                tutorRepository,
                userRepository,
                userRoleRepository,
                mock(LearningSubjectLookupService.class)
        );

        staffService = new StaffService(
                tutorRepository,
                tutorApplicationRepository,
                tutorService
        );

        user = user(10L, "tutor@example.com");
        tutor = new Tutor();
        tutor.setUser(user);
        tutor.setStatus(TutorStatus.PENDING);
        application = draftApplication(100L, user);

        when(userRepository.findByEmailIgnoreCase("tutor@example.com")).thenReturn(Optional.of(user));
        when(userRepository.findByEmail("tutor@example.com")).thenReturn(Optional.of(user));
        when(tutorRepository.findByUserId(10L)).thenReturn(Optional.of(tutor));
        when(tutorRepository.save(any(Tutor.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(tutorApplicationRepository.findByUserId(10L)).thenReturn(Optional.of(application));
        when(tutorApplicationRepository.save(any(TutorApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRoleRepository.existsByUserIdAndRole(any(), any())).thenReturn(true);
    }

    @Test
    void submitMovesDraftApplicationToPendingOnlyAfterCompletenessValidation() {
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(100L))
                .thenReturn(List.of(document(application, TutorDocumentType.PASSPORT)));

        var response = tutorApplicationService.submitMyApplication("tutor@example.com");

        assertThat(response.getStatus()).isEqualTo(TutorApplicationStatus.PENDING);
        assertThat(application.getStatus()).isEqualTo(TutorApplicationStatus.PENDING);
        assertThat(application.getSubmittedAt()).isNotNull();
        assertThat(tutor.getStatus()).isEqualTo(TutorStatus.PENDING);
        assertThat(tutor.getRejectionReason()).isNull();
    }

    @Test
    void rejectedApplicationCanBeEditedWithoutBeingTreatedAsSubmittedAgain() {
        application.setStatus(TutorApplicationStatus.REJECTED);
        tutor.setStatus(TutorStatus.REJECTED);
        tutor.setRejectionReason("Can bo sung minh chung");
        UpdateTutorApplicationRequest request = new UpdateTutorApplicationRequest();
        request.setBio("Thong tin da cap nhat");

        var response = tutorApplicationService.updateMyApplication("tutor@example.com", request);

        assertThat(response.getStatus()).isEqualTo(TutorApplicationStatus.REJECTED);
        assertThat(application.getBio()).isEqualTo("Thong tin da cap nhat");
        assertThat(tutor.getStatus()).isEqualTo(TutorStatus.REJECTED);
    }

    @Test
    void rejectedTutorProfileEditDoesNotAutoResubmit() {
        tutor.setStatus(TutorStatus.REJECTED);
        tutor.setRejectionReason("Can bo sung ho so");
        TutorProfileRequest request = new TutorProfileRequest();
        request.setBio("Bio moi");
        request.setEducation("Dai hoc");
        request.setExperienceYears(2);

        var response = tutorService.updateProfile("tutor@example.com", request);

        assertThat(response.getStatus()).isEqualTo(TutorStatus.REJECTED);
        assertThat(response.getRejectionReason()).isEqualTo("Can bo sung ho so");
    }

    @Test
    void submitProfileForReviewSyncsRejectedTutorBackToPending() {
        tutor.setStatus(TutorStatus.REJECTED);
        tutor.setRejectionReason("Can bo sung CCCD");
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(100L))
                .thenReturn(List.of(document(application, TutorDocumentType.PASSPORT)));

        var response = tutorDocumentService.submitProfileForReview("tutor@example.com");

        assertThat(response.getStatus()).isEqualTo(TutorApplicationStatus.PENDING);
        assertThat(tutor.getStatus()).isEqualTo(TutorStatus.PENDING);
        assertThat(tutor.getRejectionReason()).isNull();
    }

    @Test
    void staffPendingTutorListUsesSubmittedPendingApplications() {
        TutorApplication pending = draftApplication(101L, user);
        pending.setStatus(TutorApplicationStatus.PENDING);
        when(tutorApplicationRepository.findByStatus(TutorApplicationStatus.PENDING)).thenReturn(List.of(pending));

        var result = staffService.getPendingTutors();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getUserId()).isEqualTo(10L);
        verify(tutorApplicationRepository).findByStatus(TutorApplicationStatus.PENDING);
    }

    @Test
    void legacyStaffApproveRequiresSubmittedPendingApplication() {
        ReflectionTestUtils.setField(tutor, "id", 77L);
        when(tutorRepository.findById(77L)).thenReturn(Optional.of(tutor));
        when(tutorApplicationRepository.findByUserId(10L)).thenReturn(Optional.of(application));

        assertThatThrownBy(() -> staffService.approveTutor(77L))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Tutor application has not been submitted for review");
    }

    @Test
    void legacyStaffApproveSyncsSubmittedApplicationToApproved() {
        ReflectionTestUtils.setField(tutor, "id", 78L);
        application.setStatus(TutorApplicationStatus.PENDING);
        when(tutorRepository.findById(78L)).thenReturn(Optional.of(tutor));
        when(tutorApplicationRepository.findByUserId(10L)).thenReturn(Optional.of(application));

        var response = staffService.approveTutor(78L);

        assertThat(response.getStatus()).isEqualTo(TutorStatus.APPROVED);
        assertThat(application.getStatus()).isEqualTo(TutorApplicationStatus.APPROVED);
        assertThat(application.getReviewedAt()).isNotNull();
    }

    private User user(Long id, String email) {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", id);
        user.setEmail(email);
        user.setFullName("Nguyen Van A");
        user.setEmailVerified(true);
        user.setAccountStatus(AccountStatus.ACTIVE);
        return user;
    }

    private TutorApplication draftApplication(Long id, User user) {
        TutorApplication application = new TutorApplication();
        ReflectionTestUtils.setField(application, "id", id);
        application.setUser(user);
        application.setStatus(TutorApplicationStatus.DRAFT);
        return application;
    }

    private TutorDocument document(TutorApplication application, TutorDocumentType type) {
        TutorDocument document = new TutorDocument();
        document.setTutorApplication(application);
        document.setDocumentType(type);
        document.setFileKey("files/" + type.name().toLowerCase() + ".png");
        document.setOriginalFilename(type.name().toLowerCase() + ".png");
        document.setContentType("image/png");
        document.setFileSize(1024L);
        return document;
    }
}
