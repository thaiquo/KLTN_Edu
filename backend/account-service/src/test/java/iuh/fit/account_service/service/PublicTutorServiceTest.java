package iuh.fit.account_service.service;

import iuh.fit.account_service.dto.tutor.PublicTutorResponse;
import iuh.fit.account_service.entity.Subject;
import iuh.fit.account_service.entity.SubjectCategory;
import iuh.fit.account_service.entity.TutorProfile;
import iuh.fit.account_service.entity.TutorSubject;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.TeachingLevel;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.repository.TutorProfileRepository;
import iuh.fit.account_service.repository.TutorSubjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PublicTutorServiceTest {

    private final TutorProfileRepository tutorProfileRepository = mock(TutorProfileRepository.class);
    private final TutorSubjectRepository tutorSubjectRepository = mock(TutorSubjectRepository.class);
    private PublicTutorService service;

    @BeforeEach
    void setUp() {
        service = new PublicTutorService(tutorProfileRepository, tutorSubjectRepository);
    }

    @Test
    void searchReturnsActiveTutorWithActiveSubjects() {
        TutorProfile profile = profile(30L, "Nguyen Van A");
        TutorSubject javaSubject = tutorSubject(profile, subject(10L, "Java"), "180000");

        when(tutorProfileRepository.searchPublicTutors(eq("java"), eq(null), eq(null), eq(null), any(Pageable.class)))
                .thenReturn(List.of(profile));
        when(tutorSubjectRepository.findActiveByTutorProfileIds(List.of(30L))).thenReturn(List.of(javaSubject));

        List<PublicTutorResponse> responses = service.searchTutors(" java ", null, null, null, 10);

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).getFullName()).isEqualTo("Nguyen Van A");
        assertThat(responses.get(0).getSubjects()).extracting("name").containsExactly("Java");
    }

    @Test
    void searchHidesTutorWhenRepositoryFindsNoPublicProfiles() {
        when(tutorProfileRepository.searchPublicTutors(eq(null), eq(null), eq(null), eq(null), any(Pageable.class)))
                .thenReturn(List.of());

        List<PublicTutorResponse> responses = service.searchTutors(null, null, null, null, 10);

        assertThat(responses).isEmpty();
    }

    @Test
    void searchFiltersListSubjectsByRequestedSubjectAndRate() {
        TutorProfile profile = profile(30L, "Nguyen Van A");
        TutorSubject javaSubject = tutorSubject(profile, subject(10L, "Java"), "180000");
        TutorSubject math = tutorSubject(profile, subject(11L, "Math"), "120000");

        when(tutorProfileRepository.searchPublicTutors(
                eq(null),
                eq(10L),
                eq(new BigDecimal("150000")),
                eq(new BigDecimal("220000")),
                any(Pageable.class)
        )).thenReturn(List.of(profile));
        when(tutorSubjectRepository.findActiveByTutorProfileIds(List.of(30L))).thenReturn(List.of(javaSubject, math));

        List<PublicTutorResponse> responses = service.searchTutors(
                null,
                10L,
                new BigDecimal("150000"),
                new BigDecimal("220000"),
                10
        );

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).getSubjects()).extracting("subjectId").containsExactly(10L);
    }

    @Test
    void detailReturnsPublicFieldsOnlyAndActiveSubjects() {
        TutorProfile profile = profile(30L, "Nguyen Van A");
        TutorSubject javaSubject = tutorSubject(profile, subject(10L, "Java"), "180000");

        when(tutorProfileRepository.findByIdAndActiveTrue(30L)).thenReturn(Optional.of(profile));
        when(tutorSubjectRepository.findActiveByTutorProfileId(30L)).thenReturn(List.of(javaSubject));

        PublicTutorResponse response = service.getTutor(30L);

        assertThat(response.getId()).isEqualTo(30L);
        assertThat(response.getFullName()).isEqualTo("Nguyen Van A");
        assertThat(response.getSubjects()).hasSize(1);
        assertThat(response.getSubjects().get(0).getLevels()).containsExactly(TeachingLevel.UNIVERSITY);
        assertThat(Arrays.stream(PublicTutorResponse.class.getDeclaredFields()).map(java.lang.reflect.Field::getName))
                .doesNotContain("email", "phone", "dateOfBirth", "fileKey", "rejectionReason", "reviewedBy");
    }

    @Test
    void detailReturnsNotFoundForInactiveOrSubjectlessProfile() {
        TutorProfile profile = profile(30L, "Nguyen Van A");
        when(tutorProfileRepository.findByIdAndActiveTrue(30L)).thenReturn(Optional.of(profile));
        when(tutorSubjectRepository.findActiveByTutorProfileId(30L)).thenReturn(List.of());

        assertThatThrownBy(() -> service.getTutor(30L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Tutor profile not found");
    }

    @Test
    void invalidRateRangeReturnsBadRequest() {
        assertThatThrownBy(() -> service.searchTutors(null, null, new BigDecimal("200000"), new BigDecimal("100000"), 10))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Minimum rate must be less than or equal to maximum rate");
    }

    private TutorProfile profile(Long id, String fullName) {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 7L);
        user.setEmail("private@example.com");
        user.setPhone("0900000000");
        user.setFullName(fullName);
        user.setPassword("hash");

        TutorProfile profile = new TutorProfile();
        ReflectionTestUtils.setField(profile, "id", id);
        profile.setUser(user);
        profile.setBio("Public tutor bio");
        profile.setActive(true);
        return profile;
    }

    private TutorSubject tutorSubject(TutorProfile profile, Subject subject, String rate) {
        TutorSubject tutorSubject = new TutorSubject();
        tutorSubject.setTutorProfile(profile);
        tutorSubject.setSubject(subject);
        tutorSubject.setOneToOneHourlyRate(new BigDecimal(rate));
        tutorSubject.setExperienceYears(2);
        tutorSubject.setDescription("Subject experience");
        tutorSubject.setActive(true);
        tutorSubject.setLevels(Set.of(TeachingLevel.UNIVERSITY));
        return tutorSubject;
    }

    private Subject subject(Long id, String name) {
        SubjectCategory category = new SubjectCategory();
        category.setId(2L);
        category.setName("Công nghệ thông tin");

        Subject subject = new Subject();
        subject.setId(id);
        subject.setName(name);
        subject.setCategory(category);
        subject.setActive(true);
        subject.setSupportedLevels(Set.of(TeachingLevel.UNIVERSITY, TeachingLevel.ADULT));
        return subject;
    }
}
