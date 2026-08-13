package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.staff.StaffRejectTutorApplicationRequest;
import iuh.fit.account_service.dto.staff.StaffReviewNoteRequest;
import iuh.fit.account_service.entity.Subject;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.TutorApplicationSubject;
import iuh.fit.account_service.entity.TutorDocument;
import iuh.fit.account_service.entity.TutorProfile;
import iuh.fit.account_service.entity.TutorSubject;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.UserRole;
import iuh.fit.account_service.enums.Role;
import iuh.fit.account_service.enums.TeachingLevel;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.enums.TutorDocumentType;
import iuh.fit.account_service.enums.TutorDocumentVerificationStatus;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorApplicationSubjectRepository;
import iuh.fit.account_service.repository.TutorDocumentRepository;
import iuh.fit.account_service.repository.TutorProfileRepository;
import iuh.fit.account_service.repository.TutorSubjectRepository;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import iuh.fit.account_service.service.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TutorApprovalServiceTest {

    private final TutorApplicationRepository applicationRepository = mock(TutorApplicationRepository.class);
    private final TutorApplicationSubjectRepository applicationSubjectRepository = mock(TutorApplicationSubjectRepository.class);
    private final TutorDocumentRepository documentRepository = mock(TutorDocumentRepository.class);
    private final TutorProfileRepository profileRepository = mock(TutorProfileRepository.class);
    private final TutorSubjectRepository tutorSubjectRepository = mock(TutorSubjectRepository.class);
    private final UserRoleRepository userRoleRepository = mock(UserRoleRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final FileStorageService fileStorageService = mock(FileStorageService.class);
    private TutorApprovalService service;
    private User applicant;
    private User reviewer;
    private TutorApplication application;

    @BeforeEach
    void setUp() {
        service = new TutorApprovalService(
                applicationRepository,
                applicationSubjectRepository,
                documentRepository,
                profileRepository,
                tutorSubjectRepository,
                userRoleRepository,
                userRepository,
                fileStorageService
        );
        applicant = user(7L, "student@example.com");
        applicant.setEmailVerified(true);
        applicant.setAvatarKey("avatars/7/profile.png");
        reviewer = user(9L, "staff@example.com");
        application = completeApplication(TutorApplicationStatus.PENDING);
        when(applicationRepository.findById(20L)).thenReturn(Optional.of(application));
        when(userRepository.findByEmailIgnoreCase("staff@example.com")).thenReturn(Optional.of(reviewer));
        when(applicationSubjectRepository.findByTutorApplication_IdOrderByCreatedAtAsc(20L)).thenReturn(List.of(applicationSubject(subject(3L, "Java"))));
        when(documentRepository.findByTutorApplication_IdOrderByUploadedAtDesc(20L))
                .thenReturn(List.of(document(TutorDocumentType.PASSPORT), document(TutorDocumentType.DEGREE)));
        when(profileRepository.save(org.mockito.ArgumentMatchers.any(TutorProfile.class)))
                .thenAnswer(invocation -> {
                    TutorProfile profile = invocation.getArgument(0);
                    if (profile.getId() == null) {
                        ReflectionTestUtils.setField(profile, "id", 30L);
                    }
                    return profile;
                });
    }

    @Test
    void approveSuccessAddsTutorRoleCreatesProfileSubjectsAndVerifiesDocuments() {
        TutorProfile profile = profile(30L);
        when(userRoleRepository.existsByUserIdAndRole(7L, Role.TUTOR)).thenReturn(false);
        when(profileRepository.findByUserId(7L)).thenReturn(Optional.empty());

        var response = service.approve(20L, "staff@example.com", note(" Looks good "));

        assertThat(response.getApplication().getStatus()).isEqualTo(TutorApplicationStatus.APPROVED);
        assertThat(application.getReviewedBy()).isEqualTo(reviewer);
        assertThat(application.getReviewNote()).isEqualTo("Looks good");
        verify(userRoleRepository).save(org.mockito.ArgumentMatchers.argThat(role -> role.getUser() == applicant && role.getRole() == Role.TUTOR));
        verify(tutorSubjectRepository).saveAll(org.mockito.ArgumentMatchers.argThat((List<TutorSubject> saved) ->
                saved.size() == 1
                        && saved.get(0).getSubject().getId().equals(3L)
                        && saved.get(0).isActive()
                        && saved.get(0).getLevels().contains(TeachingLevel.UNIVERSITY)
        ));
        verify(documentRepository).saveAll(org.mockito.ArgumentMatchers.argThat((List<TutorDocument> docs) ->
                docs.stream().allMatch(doc -> doc.getVerificationStatus() == TutorDocumentVerificationStatus.VERIFIED)
        ));
    }

    @Test
    void approveDoesNotDuplicateTutorRole() {
        when(userRoleRepository.existsByUserIdAndRole(7L, Role.TUTOR)).thenReturn(true);
        when(profileRepository.findByUserId(7L)).thenReturn(Optional.of(profile(30L)));

        service.approve(20L, "staff@example.com", note(null));

        verify(userRoleRepository, never()).save(org.mockito.ArgumentMatchers.any(UserRole.class));
    }

    @Test
    void approveUpdatesExistingSubjectAndDeactivatesRemovedSubject() {
        TutorProfile profile = profile(30L);
        TutorSubject existingJava = tutorSubject(profile, subject(3L, "Java"), false);
        TutorSubject oldMath = tutorSubject(profile, subject(4L, "Math"), true);
        when(profileRepository.findByUserId(7L)).thenReturn(Optional.of(profile));
        when(tutorSubjectRepository.findByTutorProfile_IdOrderByCreatedAtAsc(30L)).thenReturn(List.of(existingJava, oldMath));

        service.approve(20L, "staff@example.com", note(null));

        assertThat(existingJava.isActive()).isTrue();
        assertThat(existingJava.getOneToOneHourlyRate()).isEqualByComparingTo("180000");
        assertThat(existingJava.getLevels()).containsExactly(TeachingLevel.UNIVERSITY);
        assertThat(oldMath.isActive()).isFalse();
    }

    @Test
    void rejectPendingStoresReasonWithoutTutorRoleOrProfileMapping() {
        StaffRejectTutorApplicationRequest request = new StaffRejectTutorApplicationRequest();
        request.setReason(" Missing credential ");
        request.setNote(" Try again ");

        var response = service.reject(20L, "staff@example.com", request);

        assertThat(response.getApplication().getStatus()).isEqualTo(TutorApplicationStatus.REJECTED);
        assertThat(application.getRejectionReason()).isEqualTo("Missing credential");
        assertThat(application.getReviewNote()).isEqualTo("Try again");
        verify(userRoleRepository, never()).save(org.mockito.ArgumentMatchers.any(UserRole.class));
        verify(profileRepository, never()).save(org.mockito.ArgumentMatchers.any(TutorProfile.class));
    }

    @Test
    void approveInvalidStatusReturnsConflict() {
        application.setStatus(TutorApplicationStatus.APPROVED);

        assertThatThrownBy(() -> service.approve(20L, "staff@example.com", note(null)))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Tutor application has already been processed");
    }

    @Test
    void staffDetailReadsApplicantSnapshotInsteadOfLiveUserProfile() {
        application.setApplicantFullName("Nguyen A");
        application.setApplicantEmail("submitted@example.com");
        application.setApplicantPhone("0909009000");
        application.setApplicantDateOfBirth(java.time.LocalDate.of(2001, 3, 4));
        application.setApplicantGender("FEMALE");
        application.setApplicantProvinceName("Thành phố Hồ Chí Minh");
        application.setApplicantCommuneName("Phường Gò Vấp");
        application.setApplicantAddressDetail("12 Nguyen Van Bao");
        application.setApplicantAvatarKey("avatars/7/submitted.png");
        applicant.setFullName("Nguyen B");
        applicant.setPhone("0999999999");
        applicant.setAvatarKey("avatars/7/live.png");

        var response = service.getApplicationDetail(20L);

        assertThat(response.getApplicant().getFullName()).isEqualTo("Nguyen A");
        assertThat(response.getApplicant().getEmail()).isEqualTo("submitted@example.com");
        assertThat(response.getApplicant().getPhone()).isEqualTo("0909009000");
        assertThat(response.getApplicant().getDateOfBirth()).isEqualTo(java.time.LocalDate.of(2001, 3, 4));
        assertThat(response.getApplicant().getGender()).isEqualTo("FEMALE");
        assertThat(response.getApplicant().getProvince()).isEqualTo("Thành phố Hồ Chí Minh");
        assertThat(response.getApplicant().getCommune()).isEqualTo("Phường Gò Vấp");
        assertThat(response.getApplicant().getAddressDetail()).isEqualTo("12 Nguyen Van Bao");
    }

    private StaffReviewNoteRequest note(String value) {
        StaffReviewNoteRequest request = new StaffReviewNoteRequest();
        request.setNote(value);
        return request;
    }

    private TutorApplication completeApplication(TutorApplicationStatus status) {
        TutorApplication next = new TutorApplication();
        ReflectionTestUtils.setField(next, "id", 20L);
        next.setUser(applicant);
        next.setStatus(status);
        next.setEducationLevel("UNIVERSITY");
        next.setInstitution("IUH");
        next.setExperienceSummary("Two years");
        next.setBio("Tutor bio");
        return next;
    }

    private TutorApplicationSubject applicationSubject(Subject subject) {
        TutorApplicationSubject item = new TutorApplicationSubject();
        item.setSubject(subject);
        item.setOneToOneHourlyRate(new BigDecimal("180000"));
        item.setExperienceYears(2);
        item.setDescription("Java Core");
        item.setLevels(Set.of(TeachingLevel.UNIVERSITY));
        return item;
    }

    private TutorDocument document(TutorDocumentType type) {
        TutorDocument document = new TutorDocument();
        document.setDocumentType(type);
        document.setVerificationStatus(TutorDocumentVerificationStatus.PENDING);
        return document;
    }

    private TutorProfile profile(Long id) {
        TutorProfile profile = new TutorProfile();
        ReflectionTestUtils.setField(profile, "id", id);
        profile.setUser(applicant);
        return profile;
    }

    private TutorSubject tutorSubject(TutorProfile profile, Subject subject, boolean active) {
        TutorSubject tutorSubject = new TutorSubject();
        tutorSubject.setTutorProfile(profile);
        tutorSubject.setSubject(subject);
        tutorSubject.setActive(active);
        tutorSubject.setLevels(Set.of(TeachingLevel.ADULT));
        return tutorSubject;
    }

    private Subject subject(Long id, String name) {
        Subject subject = new Subject();
        subject.setId(id);
        subject.setName(name);
        subject.setActive(true);
        subject.setSupportedLevels(Set.of(TeachingLevel.UNIVERSITY, TeachingLevel.ADULT));
        return subject;
    }

    private User user(Long id, String email) {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", id);
        user.setEmail(email);
        user.setFullName("Test User");
        user.setPassword("hash");
        return user;
    }
}
