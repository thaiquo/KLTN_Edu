package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.tutorapplication.UpdateTutorApplicationRequest;
import iuh.fit.account_service.entity.Subject;
import iuh.fit.account_service.entity.TutorApplicationSubject;
import iuh.fit.account_service.entity.TutorDocument;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.enums.TutorDocumentType;
import iuh.fit.account_service.enums.TeachingLevel;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.IncompleteTutorApplicationException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorApplicationSubjectRepository;
import iuh.fit.account_service.repository.TutorDocumentRepository;
import iuh.fit.account_service.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TutorApplicationServiceTest {

    private final TutorApplicationRepository tutorApplicationRepository = mock(TutorApplicationRepository.class);
    private final TutorApplicationSubjectRepository tutorApplicationSubjectRepository = mock(TutorApplicationSubjectRepository.class);
    private final TutorDocumentRepository tutorDocumentRepository = mock(TutorDocumentRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private TutorApplicationService tutorApplicationService;
    private User user;

    @BeforeEach
    void setUp() {
        tutorApplicationService = new TutorApplicationService(
                tutorApplicationRepository,
                tutorApplicationSubjectRepository,
                tutorDocumentRepository,
                userRepository
        );
        user = user(7L, "test@example.com");
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
    }

    @Test
    void createMyApplicationCreatesDraftForAuthenticatedUser() {
        when(tutorApplicationRepository.existsByUserId(7L)).thenReturn(false);
        when(tutorApplicationRepository.save(org.mockito.ArgumentMatchers.any(TutorApplication.class)))
                .thenAnswer(invocation -> {
                    TutorApplication application = invocation.getArgument(0);
                    ReflectionTestUtils.setField(application, "id", 10L);
                    return application;
                });

        var response = tutorApplicationService.createMyApplication(" TEST@example.com ");

        assertThat(response.getId()).isEqualTo(10L);
        assertThat(response.getStatus()).isEqualTo(TutorApplicationStatus.DRAFT);
        verify(tutorApplicationRepository).save(org.mockito.ArgumentMatchers.argThat(application ->
                application.getUser() == user && application.getStatus() == TutorApplicationStatus.DRAFT
        ));
    }

    @Test
    void duplicateCreateIsRejected() {
        when(tutorApplicationRepository.existsByUserId(7L)).thenReturn(true);

        assertThatThrownBy(() -> tutorApplicationService.createMyApplication("test@example.com"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Tutor application already exists");
    }

    @Test
    void getMyApplicationReturnsOnlyCurrentUserApplication() {
        TutorApplication application = application(12L, user, TutorApplicationStatus.REJECTED);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));

        var response = tutorApplicationService.getMyApplication("test@example.com");

        assertThat(response.getId()).isEqualTo(12L);
        assertThat(response.getStatus()).isEqualTo(TutorApplicationStatus.REJECTED);
        verify(tutorApplicationRepository).findByUserId(7L);
    }

    @Test
    void getMyApplicationMissingReturnsNotFound() {
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tutorApplicationService.getMyApplication("test@example.com"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Tutor application not found");
    }

    @Test
    void updateDraftSuccessTrimsEditableFields() {
        TutorApplication application = application(12L, user, TutorApplicationStatus.DRAFT);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(tutorApplicationRepository.save(application)).thenReturn(application);

        UpdateTutorApplicationRequest request = new UpdateTutorApplicationRequest();
        request.setEducationLevel(" UNIVERSITY ");
        request.setInstitution(" IUH ");
        request.setMajor(" Software Engineering ");
        request.setExperienceSummary(" Java tutor ");
        request.setBio(" Friendly tutor ");

        var response = tutorApplicationService.updateMyApplication("test@example.com", request);

        assertThat(response.getEducationLevel()).isEqualTo("UNIVERSITY");
        assertThat(response.getInstitution()).isEqualTo("IUH");
        assertThat(response.getMajor()).isEqualTo("Software Engineering");
        assertThat(response.getExperienceSummary()).isEqualTo("Java tutor");
        assertThat(response.getBio()).isEqualTo("Friendly tutor");
        verify(tutorApplicationRepository).save(application);
    }

    @Test
    void updateRejectedSuccessKeepsRejectedStatus() {
        TutorApplication application = application(12L, user, TutorApplicationStatus.REJECTED);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(tutorApplicationRepository.save(application)).thenReturn(application);

        UpdateTutorApplicationRequest request = new UpdateTutorApplicationRequest();
        request.setBio("Updated introduction");

        var response = tutorApplicationService.updateMyApplication("test@example.com", request);

        assertThat(response.getStatus()).isEqualTo(TutorApplicationStatus.REJECTED);
        assertThat(response.getBio()).isEqualTo("Updated introduction");
    }

    @Test
    void updatePendingIsRejected() {
        TutorApplication application = application(12L, user, TutorApplicationStatus.PENDING);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));

        assertThatThrownBy(() -> tutorApplicationService.updateMyApplication("test@example.com", new UpdateTutorApplicationRequest()))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Tutor application is not editable in current status");
    }

    @Test
    void updateApprovedIsRejected() {
        TutorApplication application = application(12L, user, TutorApplicationStatus.APPROVED);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));

        assertThatThrownBy(() -> tutorApplicationService.updateMyApplication("test@example.com", new UpdateTutorApplicationRequest()))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Tutor application is not editable in current status");
    }

    @Test
    void partialUpdateDoesNotClearOtherSections() {
        TutorApplication application = application(12L, user, TutorApplicationStatus.DRAFT);
        application.setEducationLevel("UNIVERSITY");
        application.setInstitution("IUH");
        application.setMajor("Software Engineering");
        application.setExperienceSummary("Existing experience");
        application.setBio("Existing bio");
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(tutorApplicationRepository.save(application)).thenReturn(application);

        UpdateTutorApplicationRequest request = new UpdateTutorApplicationRequest();
        request.setBio("New bio");

        var response = tutorApplicationService.updateMyApplication("test@example.com", request);

        assertThat(response.getBio()).isEqualTo("New bio");
        assertThat(response.getEducationLevel()).isEqualTo("UNIVERSITY");
        assertThat(response.getInstitution()).isEqualTo("IUH");
        assertThat(response.getMajor()).isEqualTo("Software Engineering");
        assertThat(response.getExperienceSummary()).isEqualTo("Existing experience");
    }

    @Test
    void blankFieldClearsOnlySubmittedField() {
        TutorApplication application = application(12L, user, TutorApplicationStatus.DRAFT);
        application.setInstitution("IUH");
        application.setBio("Existing bio");
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(tutorApplicationRepository.save(application)).thenReturn(application);

        UpdateTutorApplicationRequest request = new UpdateTutorApplicationRequest();
        request.setInstitution("   ");

        var response = tutorApplicationService.updateMyApplication("test@example.com", request);

        assertThat(response.getInstitution()).isNull();
        assertThat(response.getBio()).isEqualTo("Existing bio");
    }

    @Test
    void submitCompleteDraftMovesToPendingAndSetsSubmittedAt() {
        TutorApplication application = completeApplication(TutorApplicationStatus.DRAFT);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(tutorApplicationSubjectRepository.findByTutorApplication_IdOrderByCreatedAtAsc(12L)).thenReturn(List.of(validSubject()));
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(12L))
                .thenReturn(List.of(document(TutorDocumentType.IDENTITY_FRONT), document(TutorDocumentType.IDENTITY_BACK), document(TutorDocumentType.DEGREE)));
        when(tutorApplicationRepository.save(application)).thenReturn(application);

        var response = tutorApplicationService.submitMyApplication("test@example.com");

        assertThat(response.getStatus()).isEqualTo(TutorApplicationStatus.PENDING);
        assertThat(application.getSubmittedAt()).isNotNull();
    }

    @Test
    void submitCopiesCurrentUserFieldsIntoApplicantSnapshot() {
        TutorApplication application = completeApplication(TutorApplicationStatus.DRAFT);
        user.setFullName("Nguyen A");
        user.setPhone("0909009000");
        user.setDateOfBirth(java.time.LocalDate.of(2001, 3, 4));
        user.setGender("MALE");
        user.setProvinceCode("HO_CHI_MINH");
        user.setProvince("Thành phố Hồ Chí Minh");
        user.setCommuneCode("HCM_GO_VAP");
        user.setCommune("Phường Gò Vấp");
        user.setAddressDetail("12 Nguyen Van Bao");
        user.setAvatarKey("avatars/7/submitted.png");
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(tutorApplicationSubjectRepository.findByTutorApplication_IdOrderByCreatedAtAsc(12L)).thenReturn(List.of(validSubject()));
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(12L))
                .thenReturn(List.of(document(TutorDocumentType.PASSPORT), document(TutorDocumentType.DEGREE)));
        when(tutorApplicationRepository.save(application)).thenReturn(application);

        tutorApplicationService.submitMyApplication("test@example.com");

        assertThat(application.getApplicantFullName()).isEqualTo("Nguyen A");
        assertThat(application.getApplicantPhone()).isEqualTo("0909009000");
        assertThat(application.getApplicantDateOfBirth()).isEqualTo(java.time.LocalDate.of(2001, 3, 4));
        assertThat(application.getApplicantGender()).isEqualTo("MALE");
        assertThat(application.getApplicantProvinceCode()).isEqualTo("HO_CHI_MINH");
        assertThat(application.getApplicantProvinceName()).isEqualTo("Thành phố Hồ Chí Minh");
        assertThat(application.getApplicantCommuneCode()).isEqualTo("HCM_GO_VAP");
        assertThat(application.getApplicantCommuneName()).isEqualTo("Phường Gò Vấp");
        assertThat(application.getApplicantAddressDetail()).isEqualTo("12 Nguyen Van Bao");
        assertThat(application.getApplicantAvatarKey()).isEqualTo("avatars/7/submitted.png");
    }

    @Test
    void submitRejectedClearsReviewFieldsAndMovesToPending() {
        TutorApplication application = completeApplication(TutorApplicationStatus.REJECTED);
        application.setRejectionReason("Missing docs");
        application.setReviewNote("Please update");
        application.setReviewedAt(java.time.LocalDateTime.now());
        application.setReviewedBy(user);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(tutorApplicationSubjectRepository.findByTutorApplication_IdOrderByCreatedAtAsc(12L)).thenReturn(List.of(validSubject()));
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(12L))
                .thenReturn(List.of(document(TutorDocumentType.PASSPORT), document(TutorDocumentType.CERTIFICATE)));
        when(tutorApplicationRepository.save(application)).thenReturn(application);

        var response = tutorApplicationService.submitMyApplication("test@example.com");

        assertThat(response.getStatus()).isEqualTo(TutorApplicationStatus.PENDING);
        assertThat(response.getRejectionReason()).isNull();
        assertThat(response.getReviewNote()).isNull();
        assertThat(response.getReviewedAt()).isNull();
    }

    @Test
    void rejectedResubmitRefreshesApplicantSnapshot() {
        TutorApplication application = completeApplication(TutorApplicationStatus.REJECTED);
        application.setApplicantFullName("Old Name");
        user.setFullName("New Name");
        user.setAvatarKey("avatars/7/new.png");
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(tutorApplicationSubjectRepository.findByTutorApplication_IdOrderByCreatedAtAsc(12L)).thenReturn(List.of(validSubject()));
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(12L))
                .thenReturn(List.of(document(TutorDocumentType.PASSPORT), document(TutorDocumentType.DEGREE)));
        when(tutorApplicationRepository.save(application)).thenReturn(application);

        tutorApplicationService.submitMyApplication("test@example.com");

        assertThat(application.getApplicantFullName()).isEqualTo("New Name");
        assertThat(application.getApplicantAvatarKey()).isEqualTo("avatars/7/new.png");
    }

    @Test
    void submitPendingIsRejected() {
        TutorApplication application = completeApplication(TutorApplicationStatus.PENDING);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));

        assertThatThrownBy(() -> tutorApplicationService.submitMyApplication("test@example.com"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Tutor application is not editable in current status");
    }

    @Test
    void submitApprovedIsRejected() {
        TutorApplication application = completeApplication(TutorApplicationStatus.APPROVED);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));

        assertThatThrownBy(() -> tutorApplicationService.submitMyApplication("test@example.com"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Tutor application is not editable in current status");
    }

    @Test
    void submitMissingSubjectsIsRejectedWithMissingItems() {
        TutorApplication application = completeApplication(TutorApplicationStatus.DRAFT);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(tutorApplicationSubjectRepository.findByTutorApplication_IdOrderByCreatedAtAsc(12L)).thenReturn(List.of());
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(12L))
                .thenReturn(List.of(document(TutorDocumentType.PASSPORT), document(TutorDocumentType.DEGREE)));

        assertThatThrownBy(() -> tutorApplicationService.submitMyApplication("test@example.com"))
                .isInstanceOf(IncompleteTutorApplicationException.class)
                .satisfies(error -> assertThat(((IncompleteTutorApplicationException) error).getMissingItems())
                        .contains("teachingSubjects"));
    }

    @Test
    void submitMissingIdentityDocumentsIsRejected() {
        TutorApplication application = completeApplication(TutorApplicationStatus.DRAFT);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(tutorApplicationSubjectRepository.findByTutorApplication_IdOrderByCreatedAtAsc(12L)).thenReturn(List.of(validSubject()));
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(12L))
                .thenReturn(List.of(document(TutorDocumentType.DEGREE)));

        assertThatThrownBy(() -> tutorApplicationService.submitMyApplication("test@example.com"))
                .isInstanceOf(IncompleteTutorApplicationException.class)
                .satisfies(error -> assertThat(((IncompleteTutorApplicationException) error).getMissingItems())
                        .contains("identityDocument"));
    }

    @Test
    void submitMissingCertificateOrDegreeIsRejected() {
        TutorApplication application = completeApplication(TutorApplicationStatus.DRAFT);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(tutorApplicationSubjectRepository.findByTutorApplication_IdOrderByCreatedAtAsc(12L)).thenReturn(List.of(validSubject()));
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(12L))
                .thenReturn(List.of(document(TutorDocumentType.PASSPORT)));

        assertThatThrownBy(() -> tutorApplicationService.submitMyApplication("test@example.com"))
                .isInstanceOf(IncompleteTutorApplicationException.class)
                .satisfies(error -> assertThat(((IncompleteTutorApplicationException) error).getMissingItems())
                        .contains("degreeOrCertificate"));
    }

    @Test
    void submitMissingApplicationFieldsIsRejected() {
        TutorApplication application = completeApplication(TutorApplicationStatus.DRAFT);
        application.setBio(null);
        application.setEducationLevel(null);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(tutorApplicationSubjectRepository.findByTutorApplication_IdOrderByCreatedAtAsc(12L)).thenReturn(List.of(validSubject()));
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(12L))
                .thenReturn(List.of(document(TutorDocumentType.PASSPORT), document(TutorDocumentType.DEGREE)));

        assertThatThrownBy(() -> tutorApplicationService.submitMyApplication("test@example.com"))
                .isInstanceOf(IncompleteTutorApplicationException.class)
                .satisfies(error -> assertThat(((IncompleteTutorApplicationException) error).getMissingItems())
                        .contains("bio", "educationLevel"));
    }

    @Test
    void submitDoesNotAddTutorRoleOrCreateTutorProfile() {
        TutorApplication application = completeApplication(TutorApplicationStatus.DRAFT);
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
        when(tutorApplicationSubjectRepository.findByTutorApplication_IdOrderByCreatedAtAsc(12L)).thenReturn(List.of(validSubject()));
        when(tutorDocumentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(12L))
                .thenReturn(List.of(document(TutorDocumentType.PASSPORT), document(TutorDocumentType.DEGREE)));
        when(tutorApplicationRepository.save(application)).thenReturn(application);

        tutorApplicationService.submitMyApplication("test@example.com");

        assertThat(application.getStatus()).isEqualTo(TutorApplicationStatus.PENDING);
    }

    private User user(Long id, String email) {
        User nextUser = new User();
        ReflectionTestUtils.setField(nextUser, "id", id);
        nextUser.setEmail(email);
        nextUser.setFullName("Test User");
        nextUser.setPassword("hash");
        nextUser.setAvatarKey("avatars/7/test.png");
        return nextUser;
    }

    private TutorApplication application(Long id, User owner, TutorApplicationStatus status) {
        TutorApplication application = new TutorApplication();
        ReflectionTestUtils.setField(application, "id", id);
        application.setUser(owner);
        application.setStatus(status);
        return application;
    }

    private TutorApplication completeApplication(TutorApplicationStatus status) {
        user.setEmailVerified(true);
        TutorApplication application = application(12L, user, status);
        application.setEducationLevel("UNIVERSITY");
        application.setInstitution("IUH");
        application.setExperienceSummary("Two years tutoring");
        application.setBio("Friendly tutor");
        return application;
    }

    private TutorApplicationSubject validSubject() {
        Subject subject = new Subject();
        subject.setId(3L);
        subject.setName("Java");
        subject.setActive(true);
        subject.setSupportedLevels(java.util.Set.of(TeachingLevel.UNIVERSITY, TeachingLevel.ADULT));

        TutorApplicationSubject applicationSubject = new TutorApplicationSubject();
        applicationSubject.setSubject(subject);
        applicationSubject.setOneToOneHourlyRate(new BigDecimal("180000"));
        applicationSubject.setExperienceYears(2);
        applicationSubject.setLevels(java.util.Set.of(TeachingLevel.UNIVERSITY));
        return applicationSubject;
    }

    private TutorDocument document(TutorDocumentType type) {
        TutorDocument document = new TutorDocument();
        document.setDocumentType(type);
        document.setOriginalFilename(type.name() + ".pdf");
        document.setContentType("application/pdf");
        document.setFileKey("test-key");
        document.setFileSize(100L);
        return document;
    }
}
