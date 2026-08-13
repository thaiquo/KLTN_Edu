package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.tutorapplication.TutorApplicationSubjectRequest;
import iuh.fit.account_service.dto.tutorapplication.UpdateTutorApplicationSubjectRequest;
import iuh.fit.account_service.entity.Subject;
import iuh.fit.account_service.entity.SubjectCategory;
import iuh.fit.account_service.entity.TutorApplication;
import iuh.fit.account_service.entity.TutorApplicationSubject;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.TeachingLevel;
import iuh.fit.account_service.enums.TutorApplicationStatus;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.repository.SubjectRepository;
import iuh.fit.account_service.repository.TutorApplicationRepository;
import iuh.fit.account_service.repository.TutorApplicationSubjectRepository;
import iuh.fit.account_service.repository.UserRepository;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TutorApplicationSubjectServiceTest {

    private final TutorApplicationRepository tutorApplicationRepository = mock(TutorApplicationRepository.class);
    private final TutorApplicationSubjectRepository tutorApplicationSubjectRepository = mock(TutorApplicationSubjectRepository.class);
    private final SubjectRepository subjectRepository = mock(SubjectRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private TutorApplicationSubjectService service;
    private User user;
    private TutorApplication application;
    private Subject subject;

    @BeforeEach
    void setUp() {
        service = new TutorApplicationSubjectService(
                tutorApplicationRepository,
                tutorApplicationSubjectRepository,
                subjectRepository,
                userRepository
        );

        user = user(7L, "test@example.com");
        application = application(20L, user, TutorApplicationStatus.DRAFT);
        subject = subject(3L, "Java", true);
        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(user));
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.of(application));
    }

    @Test
    void addSubjectSuccessPersistsMetadataForActiveSubject() {
        when(subjectRepository.findById(3L)).thenReturn(Optional.of(subject));
        when(tutorApplicationSubjectRepository.existsByTutorApplication_IdAndSubject_Id(20L, 3L)).thenReturn(false);
        when(tutorApplicationSubjectRepository.save(org.mockito.ArgumentMatchers.any(TutorApplicationSubject.class)))
                .thenAnswer(invocation -> {
                    TutorApplicationSubject saved = invocation.getArgument(0);
                    ReflectionTestUtils.setField(saved, "id", 44L);
                    return saved;
                });

        var response = service.addSubject(" TEST@example.com ", createRequest(3L, "180000.00", 2, " Java Core "));

        assertThat(response.getId()).isEqualTo(44L);
        assertThat(response.getSubject().getName()).isEqualTo("Java");
        assertThat(response.getSubject().getCategory()).isEqualTo("Programming");
        assertThat(response.getOneToOneHourlyRate()).isEqualByComparingTo("180000.00");
        assertThat(response.getExperienceYears()).isEqualTo(2);
        assertThat(response.getDescription()).isEqualTo("Java Core");
        assertThat(response.getLevels()).containsExactly(TeachingLevel.UNIVERSITY);
        verify(tutorApplicationSubjectRepository).save(org.mockito.ArgumentMatchers.argThat(saved ->
                saved.getTutorApplication() == application
                        && saved.getSubject() == subject
                        && saved.getLevels().contains(TeachingLevel.UNIVERSITY)
                        && saved.getOneToOneHourlyRate().compareTo(new BigDecimal("180000.00")) == 0
        ));
    }

    @Test
    void duplicateSubjectIsRejected() {
        when(subjectRepository.findById(3L)).thenReturn(Optional.of(subject));
        when(tutorApplicationSubjectRepository.existsByTutorApplication_IdAndSubject_Id(20L, 3L)).thenReturn(true);

        assertThatThrownBy(() -> service.addSubject("test@example.com", createRequest(3L, "180000", 2, null)))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Subject already exists in tutor application");
    }

    @Test
    void inactiveSubjectIsRejected() {
        when(subjectRepository.findById(3L)).thenReturn(Optional.of(subject(3L, "Java", false)));

        assertThatThrownBy(() -> service.addSubject("test@example.com", createRequest(3L, "180000", 2, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Subject is inactive");
    }

    @Test
    void unsupportedLevelIsRejected() {
        when(subjectRepository.findById(3L)).thenReturn(Optional.of(subject));
        TutorApplicationSubjectRequest request = createRequest(3L, "180000", 2, null);
        request.setLevels(Set.of(TeachingLevel.PRIMARY));

        assertThatThrownBy(() -> service.addSubject("test@example.com", request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("One or more teaching levels are not supported by this subject");
    }

    @Test
    void listSubjectsReturnsOnlyCurrentApplicationSubjects() {
        TutorApplicationSubject row = row(50L, application, subject, "180000", 2, "Java");
        when(tutorApplicationSubjectRepository.findByTutorApplication_IdOrderByCreatedAtAsc(20L))
                .thenReturn(List.of(row));

        var response = service.listMySubjects("test@example.com");

        assertThat(response).hasSize(1);
        assertThat(response.get(0).getId()).isEqualTo(50L);
        verify(tutorApplicationSubjectRepository).findByTutorApplication_IdOrderByCreatedAtAsc(20L);
    }

    @Test
    void updateMetadataSuccessDoesNotChangeSubject() {
        TutorApplicationSubject row = row(50L, application, subject, "180000", 2, "Old");
        when(tutorApplicationSubjectRepository.findByIdAndTutorApplication_Id(50L, 20L)).thenReturn(Optional.of(row));
        when(tutorApplicationSubjectRepository.save(row)).thenReturn(row);

        var response = service.updateSubject("test@example.com", 50L, updateRequest("200000", 3, " New "));

        assertThat(row.getSubject()).isSameAs(subject);
        assertThat(row.getOneToOneHourlyRate()).isEqualByComparingTo("200000");
        assertThat(row.getExperienceYears()).isEqualTo(3);
        assertThat(row.getDescription()).isEqualTo("New");
        assertThat(row.getLevels()).containsExactly(TeachingLevel.UNIVERSITY);
        assertThat(response.getSubject().getId()).isEqualTo(3L);
    }

    @Test
    void updateWhilePendingIsRejected() {
        application.setStatus(TutorApplicationStatus.PENDING);

        assertThatThrownBy(() -> service.updateSubject("test@example.com", 50L, updateRequest("200000", 3, "New")))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Tutor application is not editable in current status");
    }

    @Test
    void deleteSubjectSuccessInDraft() {
        TutorApplicationSubject row = row(50L, application, subject, "180000", 2, "Java");
        when(tutorApplicationSubjectRepository.findByIdAndTutorApplication_Id(50L, 20L)).thenReturn(Optional.of(row));

        service.deleteSubject("test@example.com", 50L);

        verify(tutorApplicationSubjectRepository).delete(row);
    }

    @Test
    void deleteWhileApprovedIsRejected() {
        application.setStatus(TutorApplicationStatus.APPROVED);

        assertThatThrownBy(() -> service.deleteSubject("test@example.com", 50L))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Tutor application is not editable in current status");
    }

    @Test
    void ownershipPreventsModifyingAnotherUsersApplicationSubject() {
        when(tutorApplicationSubjectRepository.findByIdAndTutorApplication_Id(99L, 20L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateSubject("test@example.com", 99L, updateRequest("200000", 3, "New")))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Tutor application subject not found");
    }

    @Test
    void subjectEndpointRequiresExistingTutorApplication() {
        when(tutorApplicationRepository.findByUserId(7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.listMySubjects("test@example.com"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Tutor application not found");
    }

    private TutorApplicationSubjectRequest createRequest(Long subjectId, String rate, Integer years, String description) {
        TutorApplicationSubjectRequest request = new TutorApplicationSubjectRequest();
        request.setSubjectId(subjectId);
        request.setOneToOneHourlyRate(new BigDecimal(rate));
        request.setExperienceYears(years);
        request.setDescription(description);
        request.setLevels(Set.of(TeachingLevel.UNIVERSITY));
        return request;
    }

    private UpdateTutorApplicationSubjectRequest updateRequest(String rate, Integer years, String description) {
        UpdateTutorApplicationSubjectRequest request = new UpdateTutorApplicationSubjectRequest();
        request.setOneToOneHourlyRate(new BigDecimal(rate));
        request.setExperienceYears(years);
        request.setDescription(description);
        request.setLevels(Set.of(TeachingLevel.UNIVERSITY));
        return request;
    }

    private TutorApplicationSubject row(
            Long id,
            TutorApplication owner,
            Subject rowSubject,
            String rate,
            Integer years,
            String description
    ) {
        TutorApplicationSubject row = new TutorApplicationSubject();
        ReflectionTestUtils.setField(row, "id", id);
        row.setTutorApplication(owner);
        row.setSubject(rowSubject);
        row.setOneToOneHourlyRate(new BigDecimal(rate));
        row.setExperienceYears(years);
        row.setDescription(description);
        row.setLevels(Set.of(TeachingLevel.UNIVERSITY));
        return row;
    }

    private TutorApplication application(Long id, User owner, TutorApplicationStatus status) {
        TutorApplication nextApplication = new TutorApplication();
        ReflectionTestUtils.setField(nextApplication, "id", id);
        nextApplication.setUser(owner);
        nextApplication.setStatus(status);
        return nextApplication;
    }

    private User user(Long id, String email) {
        User nextUser = new User();
        ReflectionTestUtils.setField(nextUser, "id", id);
        nextUser.setEmail(email);
        nextUser.setFullName("Test User");
        nextUser.setPassword("hash");
        return nextUser;
    }

    private Subject subject(Long id, String name, boolean active) {
        SubjectCategory category = new SubjectCategory();
        category.setId(9L);
        category.setName("Programming");

        Subject nextSubject = new Subject();
        nextSubject.setId(id);
        nextSubject.setName(name);
        nextSubject.setCategory(category);
        nextSubject.setActive(active);
        nextSubject.setSupportedLevels(Set.of(TeachingLevel.UNIVERSITY, TeachingLevel.ADULT));
        return nextSubject;
    }
}
