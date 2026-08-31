package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.staff.StaffRejectTutorApplicationRequest;
import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.TutorDocument;
import iuh.fit.account_service.entity.TutorProfile;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.enums.TutorDocumentType;
import iuh.fit.account_service.enums.TutorDocumentVerificationStatus;
import iuh.fit.account_service.enums.TutorStatus;
import iuh.fit.account_service.messaging.AccountEventPublisher;
import iuh.fit.account_service.realtime.RealtimeEventHub;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorApplicationSubjectRepository;
import iuh.fit.account_service.repository.TutorDocumentRepository;
import iuh.fit.account_service.repository.TutorProfileRepository;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import iuh.fit.account_service.service.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TutorApprovalServiceStatusSyncTest {

    private TutorApplicationRepository tutorApplicationRepository;
    private TutorApplicationSubjectRepository tutorApplicationSubjectRepository;
    private TutorDocumentRepository tutorDocumentRepository;
    private TutorRepository tutorRepository;
    private TutorProfileRepository tutorProfileRepository;
    private UserRoleRepository userRoleRepository;
    private UserRepository userRepository;
    private FileStorageService fileStorageService;
    private AccountEventPublisher eventPublisher;
    private RealtimeEventHub realtimeEventHub;
    private TutorApprovalService service;

    @BeforeEach
    void setUp() {
        tutorApplicationRepository = mock(TutorApplicationRepository.class);
        tutorApplicationSubjectRepository = mock(TutorApplicationSubjectRepository.class);
        tutorDocumentRepository = mock(TutorDocumentRepository.class);
        tutorRepository = mock(TutorRepository.class);
        tutorProfileRepository = mock(TutorProfileRepository.class);
        userRoleRepository = mock(UserRoleRepository.class);
        userRepository = mock(UserRepository.class);
        fileStorageService = mock(FileStorageService.class);
        eventPublisher = mock(AccountEventPublisher.class);
        realtimeEventHub = mock(RealtimeEventHub.class);

        service = new TutorApprovalService(
                tutorApplicationRepository,
                tutorApplicationSubjectRepository,
                tutorDocumentRepository,
                tutorRepository,
                tutorProfileRepository,
                userRoleRepository,
                userRepository,
                fileStorageService,
                eventPublisher,
                realtimeEventHub
        );
    }

    @Test
    void approveSyncsTutorStatusToApproved() {
        User applicant = user(10L, "pending@example.com");
        User reviewer = user(20L, "staff@example.com");
        TutorApplication application = pendingApplication(100L, applicant);
        Tutor tutor = tutor(applicant, TutorStatus.PENDING);
        TutorProfile profile = new TutorProfile();
        profile.setUser(applicant);

        when(tutorApplicationRepository.findById(100L)).thenReturn(Optional.of(application));
        when(userRepository.findByEmailIgnoreCase("staff@example.com")).thenReturn(Optional.of(reviewer));
        when(tutorApplicationSubjectRepository.findByTutorApplication_IdOrderByCreatedAtAsc(100L)).thenReturn(List.of());
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(100L))
                .thenReturn(List.of(identityDocument(application)));
        when(userRoleRepository.existsByUserIdAndRole(any(), any())).thenReturn(true);
        when(tutorRepository.findByUserId(10L)).thenReturn(Optional.of(tutor));
        when(tutorRepository.save(any(Tutor.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(tutorProfileRepository.findByUserId(10L)).thenReturn(Optional.of(profile));
        when(tutorProfileRepository.save(any(TutorProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.approve(100L, "staff@example.com", null);

        ArgumentCaptor<Tutor> tutorCaptor = ArgumentCaptor.forClass(Tutor.class);
        verify(tutorRepository).save(tutorCaptor.capture());
        assertThat(tutorCaptor.getValue().getStatus()).isEqualTo(TutorStatus.APPROVED);
        assertThat(tutorCaptor.getValue().getRejectionReason()).isNull();
        assertThat(application.getStatus()).isEqualTo(TutorApplicationStatus.APPROVED);
    }

    @Test
    void rejectSyncsTutorStatusToRejectedWithReason() {
        User applicant = user(11L, "rejected@example.com");
        User reviewer = user(21L, "staff@example.com");
        TutorApplication application = pendingApplication(101L, applicant);
        Tutor tutor = tutor(applicant, TutorStatus.PENDING);
        StaffRejectTutorApplicationRequest request = new StaffRejectTutorApplicationRequest();
        request.setReason("Minh chứng chưa rõ.");

        when(tutorApplicationRepository.findById(101L)).thenReturn(Optional.of(application));
        when(userRepository.findByEmailIgnoreCase("staff@example.com")).thenReturn(Optional.of(reviewer));
        when(userRoleRepository.existsByUserIdAndRole(any(), any())).thenReturn(true);
        when(tutorRepository.findByUserId(11L)).thenReturn(Optional.of(tutor));
        when(tutorRepository.save(any(Tutor.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(101L)).thenReturn(List.of());

        service.reject(101L, "staff@example.com", request);

        ArgumentCaptor<Tutor> tutorCaptor = ArgumentCaptor.forClass(Tutor.class);
        verify(tutorRepository).save(tutorCaptor.capture());
        assertThat(tutorCaptor.getValue().getStatus()).isEqualTo(TutorStatus.REJECTED);
        assertThat(tutorCaptor.getValue().getRejectionReason()).isEqualTo("Minh chứng chưa rõ.");
        assertThat(application.getStatus()).isEqualTo(TutorApplicationStatus.REJECTED);
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

    private TutorApplication pendingApplication(Long id, User user) {
        TutorApplication application = new TutorApplication();
        ReflectionTestUtils.setField(application, "id", id);
        application.setUser(user);
        application.setStatus(TutorApplicationStatus.PENDING);
        return application;
    }

    private Tutor tutor(User user, TutorStatus status) {
        Tutor tutor = new Tutor();
        tutor.setUser(user);
        tutor.setStatus(status);
        return tutor;
    }

    private TutorDocument identityDocument(TutorApplication application) {
        TutorDocument document = new TutorDocument();
        document.setTutorApplication(application);
        document.setDocumentType(TutorDocumentType.PASSPORT);
        document.setVerificationStatus(TutorDocumentVerificationStatus.PENDING);
        document.setFileKey("tutor-documents/passport.png");
        document.setOriginalFilename("passport.png");
        document.setContentType("image/png");
        document.setFileSize(1024L);
        return document;
    }
}
