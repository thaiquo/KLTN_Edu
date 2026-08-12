package iuh.fit.account_service.modules.tutor.service;

import iuh.fit.account_service.infrastructure.security.AuthPrincipal;
import iuh.fit.account_service.infrastructure.storage.TutorCertificateStorageService;
import iuh.fit.account_service.modules.auth.entity.Account;
import iuh.fit.account_service.modules.auth.repository.AccountRepository;
import iuh.fit.account_service.modules.role.entity.RoleEntity;
import iuh.fit.account_service.modules.role.repository.RoleRepository;
import iuh.fit.account_service.modules.tutor.dto.CertificateRequest;
import iuh.fit.account_service.modules.tutor.dto.TeachingSubjectRequest;
import iuh.fit.account_service.modules.tutor.dto.TutorApplicationRequest;
import iuh.fit.account_service.modules.tutor.entity.TutorApplication;
import iuh.fit.account_service.modules.tutor.entity.TutorProfile;
import iuh.fit.account_service.modules.tutor.enums.TutorApplicationStatus;
import iuh.fit.account_service.modules.tutor.enums.TutorStatus;
import iuh.fit.account_service.modules.tutor.repository.TutorApplicationRepository;
import iuh.fit.account_service.modules.tutor.repository.CertificateRepository;
import iuh.fit.account_service.modules.tutor.repository.TutorProfileRepository;
import iuh.fit.account_service.modules.tutor.repository.TutorApplicationEventRepository;
import iuh.fit.account_service.modules.tutor.realtime.TutorApplicationRealtimeService;
import iuh.fit.account_service.shared.enums.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
class TutorApplicationServiceTest {

    @Mock TutorApplicationRepository applicationRepository;
    @Mock TutorProfileRepository tutorProfileRepository;
    @Mock AccountRepository accountRepository;
    @Mock RoleRepository roleRepository;
    @Mock CertificateRepository certificateRepository;
    @Mock TutorCertificateStorageService certificateStorage;
    @Mock TutorApplicationEventRepository eventRepository;
    @Mock TutorApplicationRealtimeService realtimeService;

    TutorApplicationService service;

    @BeforeEach
    void setUp() {
        service = new TutorApplicationService(
            applicationRepository,
            tutorProfileRepository,
            accountRepository,
            roleRepository,
            certificateRepository,
            certificateStorage,
            eventRepository,
            realtimeService
        );
    }

    @Test
    void approve_shouldAddTutorRoleWithoutRemovingStudentRole() {
        UUID userId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        UUID applicationId = UUID.randomUUID();

        Account user = new Account();
        user.setId(userId);
        user.setRole(Role.STUDENT);

        TutorApplication application = new TutorApplication();
        application.setId(applicationId);
        application.setUser(user);
        application.setStatus(TutorApplicationStatus.SUBMITTED);

        when(applicationRepository.findById(applicationId)).thenReturn(Optional.of(application));
        when(roleRepository.findByName(Role.TUTOR)).thenReturn(Optional.of(new RoleEntity(Role.TUTOR)));
        when(tutorProfileRepository.findByUser_Id(userId)).thenReturn(Optional.empty());
        when(tutorProfileRepository.save(any(TutorProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(applicationRepository.save(application)).thenReturn(application);
        when(eventRepository.findByTutorApplication_IdOrderByCreatedAtAsc(applicationId)).thenReturn(List.of());

        service.approve(new AuthPrincipal(reviewerId, "admin@example.com", Set.of(Role.ADMIN), 0), applicationId, "Đủ điều kiện giảng dạy");

        assertThat(user.getRoles()).containsExactlyInAnyOrder(Role.STUDENT, Role.TUTOR);
        assertThat(application.getStatus()).isEqualTo(TutorApplicationStatus.APPROVED);
        assertThat(application.getReviewedBy()).isEqualTo(reviewerId);
        verify(tutorProfileRepository).save(any(TutorProfile.class));
    }

    @Test
    void create_shouldDeriveS3UrlFromOwnedKeyAndPersistIt() {
        UUID userId = UUID.randomUUID();
        String fileKey = "tutor-applications/" + userId + "/certificates/2026/08/certificate.pdf";
        String fileUrl = "https://private-bucket.s3.ap-southeast-1.amazonaws.com/" + fileKey;
        Account user = new Account();
        user.setId(userId);
        user.setRole(Role.STUDENT);

        var certificate = new CertificateRequest(
            "AWS Certificate", "AWS", LocalDate.of(2026, 8, 1), null,
            fileKey, "certificate.pdf", "application/pdf", 1024L);
        var request = new TutorApplicationRequest(List.of(), List.of(
            new TeachingSubjectRequest("it_skills", "aws", "advanced", "Bio", "Experience", List.of(certificate))));

        when(accountRepository.findById(userId)).thenReturn(Optional.of(user));
        when(certificateStorage.belongsTo(userId, fileKey)).thenReturn(true);
        when(certificateStorage.url(fileKey)).thenReturn(fileUrl);
        when(applicationRepository.save(any(TutorApplication.class))).thenAnswer(invocation -> {
            TutorApplication saved = invocation.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });
        when(eventRepository.findByTutorApplication_IdOrderByCreatedAtAsc(any(UUID.class))).thenReturn(List.of());

        var response = service.create(
            new AuthPrincipal(userId, "student@example.com", Set.of(Role.STUDENT), 0), request);

        var savedCertificate = response.teachingSubjects().getFirst().certificates().getFirst();
        assertThat(savedCertificate.fileKey()).isEqualTo(fileKey);
        assertThat(savedCertificate.fileUrl()).isEqualTo(fileUrl);
        verify(certificateStorage).url(fileKey);
    }

    @Test
    void approveLaterSubject_shouldNotAssignTutorRoleAgain() {
        UUID userId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        UUID applicationId = UUID.randomUUID();
        Account user = new Account();
        user.setId(userId);
        user.setRole(Role.STUDENT);
        user.setRole(Role.TUTOR);

        TutorApplication application = new TutorApplication();
        application.setId(applicationId);
        application.setUser(user);
        application.setStatus(TutorApplicationStatus.PENDING);
        TutorProfile profile = new TutorProfile();
        profile.setUser(user);

        when(applicationRepository.findById(applicationId)).thenReturn(Optional.of(application));
        when(tutorProfileRepository.findByUser_Id(userId)).thenReturn(Optional.of(profile));
        when(tutorProfileRepository.save(profile)).thenReturn(profile);
        when(applicationRepository.save(application)).thenReturn(application);
        when(eventRepository.findByTutorApplication_IdOrderByCreatedAtAsc(applicationId)).thenReturn(List.of());

        service.approve(
            new AuthPrincipal(reviewerId, "admin@example.com", Set.of(Role.ADMIN), 0),
            applicationId, "Approved another teaching subject");

        assertThat(user.getRoles()).containsExactlyInAnyOrder(Role.STUDENT, Role.TUTOR);
        assertThat(application.getStatus()).isEqualTo(TutorApplicationStatus.APPROVED);
        verify(roleRepository, never()).findByName(Role.TUTOR);
        verify(accountRepository, never()).save(user);
    }
}
