package iuh.fit.account_service.service;

import iuh.fit.account_service.client.LearningTutorSearchDataClient;
import iuh.fit.account_service.dto.learning.LearningTutorSearchDataResponse;
import iuh.fit.account_service.dto.tutor.TutorSearchResponseV2;
import iuh.fit.account_service.entity.Tutor;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.repository.TutorRepository;
import iuh.fit.account_service.service.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PublicTutorSearchV2ServiceTest {
    private TutorRepository tutorRepository;
    private LearningTutorSearchDataClient learningClient;
    private PublicTutorSearchV2Service service;

    @BeforeEach
    void setUp() {
        tutorRepository = mock(TutorRepository.class);
        learningClient = mock(LearningTutorSearchDataClient.class);
        FileStorageService fileStorageService = mock(FileStorageService.class);
        service = new PublicTutorSearchV2Service(tutorRepository, learningClient, fileStorageService);
    }

    @Test
    void searchReturnsPagedPublicSafeV2ResponseWithSeparateSubjectTuition() {
        Tutor tutor = tutor(101L, 9001L, "tutor1@gmail.com", "Nguyen Van A", "TPHCM", "P001", "Phuong 1", "C001");
        when(tutorRepository.findAllPublicTutors()).thenReturn(List.of(tutor));
        when(learningClient.searchData(anyList(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(learning(
                        101L,
                        9001L,
                        4.75,
                        4L,
                        capability(1L, 11L, "Toan", 3, "200000", "250000"),
                        capability(2L, 12L, "Vat ly", 5, "250000", "300000")
                )));

        TutorSearchResponseV2.PageResponse response = service.search(
                null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null,
                0, 10, "price,asc"
        );

        assertThat(response.totalElements()).isEqualTo(1);
        TutorSearchResponseV2 item = response.content().getFirst();
        assertThat(item.tutorId()).isEqualTo(101L);
        assertThat(item.userId()).isEqualTo(9001L);
        assertThat(item.startingTuition()).isEqualByComparingTo("200000");
        assertThat(item.subjects()).extracting(TutorSearchResponseV2.SubjectCapabilityResponse::tuitionMin)
                .containsExactly(new BigDecimal("200000"), new BigDecimal("250000"));
        assertThat(item.location().provinceName()).isEqualTo("TPHCM");
        assertThat(item.location().communeName()).isEqualTo("Phuong 1");
    }

    @Test
    void searchCombinesAccountLocationWithLearningCapabilityFiltersAndSortsByRating() {
        Tutor first = tutor(101L, 9001L, "tutor1@gmail.com", "An", "TPHCM", "P001", "Phuong 1", "C001");
        Tutor second = tutor(102L, 9002L, "tutor2@gmail.com", "Binh", "Ha Noi", "P002", "Phuong 2", "C002");
        when(tutorRepository.findAllPublicTutors()).thenReturn(List.of(first, second));
        when(learningClient.searchData(
                eq(List.of(101L)),
                eq(1L),
                eq(10L),
                eq(501L),
                eq(11L),
                eq(301L),
                eq("OFFLINE"),
                eq(new BigDecimal("200000")),
                eq(new BigDecimal("300000")),
                eq(4.0),
                eq(3),
                eq(2),
                eq("18:00"),
                eq("20:00")
        )).thenReturn(List.of(learning(
                101L,
                9001L,
                4.5,
                8L,
                capability(1L, 11L, "Toan", 4, "220000", "280000")
        )));

        TutorSearchResponseV2.PageResponse response = service.search(
                null, 1L, 10L, 501L, 11L, 301L, "OFFLINE", "P001", null, null, null,
                new BigDecimal("200000"), new BigDecimal("300000"), 4.0, 3,
                2, "18:00", "20:00", 0, 5, "rating,desc"
        );

        assertThat(response.totalElements()).isEqualTo(1);
        assertThat(response.content().getFirst().tutorId()).isEqualTo(101L);
    }

    @Test
    void searchExcludesTutorWithoutApprovedLearningDataAndDoesNotExposePrivateFields() {
        Tutor approvedInAccountOnly = tutor(101L, 9001L, "private@example.com", "Private Tutor", "TPHCM", "P001", "Phuong 1", "C001");
        approvedInAccountOnly.getUser().setPhone("0900000000");
        approvedInAccountOnly.getUser().setAddressDetail("123 Exact Home");
        when(tutorRepository.findAllPublicTutors()).thenReturn(List.of(approvedInAccountOnly));
        when(learningClient.searchData(anyList(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of());

        TutorSearchResponseV2.PageResponse response = service.search(
                null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null,
                0, 10, null
        );

        assertThat(response.content()).isEmpty();
    }

    @Test
    void detailReturnsPublicSafeV2TutorWithLearningData() {
        Tutor tutor = tutor(101L, 9001L, "private@example.com", "Public Tutor", "TPHCM", "P001", "Phuong 1", "C001");
        tutor.getUser().setPhone("0900000000");
        tutor.getUser().setAddressDetail("123 Exact Home");
        when(tutorRepository.findAllPublicTutors()).thenReturn(List.of(tutor));
        when(learningClient.searchData(
                eq(List.of(101L)),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull()
        )).thenReturn(List.of(learning(
                101L,
                9001L,
                4.8,
                6L,
                capability(1L, 11L, "Toan", 4, "200000", "250000")
        )));

        TutorSearchResponseV2 response = service.detail(101L);

        assertThat(response.tutorId()).isEqualTo(101L);
        assertThat(response.userId()).isEqualTo(9001L);
        assertThat(response.fullName()).isEqualTo("Public Tutor");
        assertThat(response.subjects()).hasSize(1);
        assertThat(response.subjects().getFirst().tuitionMin()).isEqualByComparingTo("200000");
        assertThat(response.location().communeName()).isEqualTo("Phuong 1");
        assertThat(response.location().provinceName()).isEqualTo("TPHCM");
        verify(learningClient).searchData(
                eq(List.of(101L)),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull(),
                isNull()
        );
    }

    @Test
    void detailThrowsNotFoundWhenLearningDataIsMissing() {
        Tutor tutor = tutor(101L, 9001L, "tutor1@gmail.com", "Public Tutor", "TPHCM", "P001", "Phuong 1", "C001");
        when(tutorRepository.findAllPublicTutors()).thenReturn(List.of(tutor));
        when(learningClient.searchData(anyList(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of());

        assertThatThrownBy(() -> service.detail(101L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Tutor public learning profile not found");
    }

    private Tutor tutor(Long tutorId, Long userId, String email, String fullName, String province, String provinceCode,
                        String commune, String communeCode) {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", userId);
        user.setEmail(email);
        user.setFullName(fullName);
        user.setEmailVerified(true);
        user.setProvince(province);
        user.setProvinceCode(provinceCode);
        user.setCommune(commune);
        user.setCommuneCode(communeCode);

        Tutor tutor = new Tutor();
        ReflectionTestUtils.setField(tutor, "id", tutorId);
        tutor.setUser(user);
        tutor.setBio("Public bio");
        return tutor;
    }

    private LearningTutorSearchDataResponse learning(
            Long tutorProfileId,
            Long userId,
            Double averageRating,
            Long reviewCount,
            LearningTutorSearchDataResponse.CapabilityResponse... capabilities
    ) {
        LearningTutorSearchDataResponse response = new LearningTutorSearchDataResponse();
        response.setTutorProfileId(tutorProfileId);
        response.setUserId(userId);
        response.setTeachingModes(Set.of("ONLINE", "OFFLINE"));
        response.setSubjects(List.of(capabilities));
        response.setStartingTuition(List.of(capabilities).stream()
                .map(LearningTutorSearchDataResponse.CapabilityResponse::getTuitionMin)
                .min(BigDecimal::compareTo)
                .orElse(null));
        response.setAverageRating(averageRating);
        response.setReviewCount(reviewCount);
        response.setPublishedClassCount(2L);
        response.setAvailability(List.of(availability()));
        return response;
    }

    private LearningTutorSearchDataResponse.CapabilityResponse capability(
            Long registrationId,
            Long subjectId,
            String subjectName,
            Integer experienceYears,
            String tuitionMin,
            String tuitionMax
    ) {
        LearningTutorSearchDataResponse.CapabilityResponse capability = new LearningTutorSearchDataResponse.CapabilityResponse();
        capability.setRegistrationId(registrationId);
        capability.setSubjectId(subjectId);
        capability.setSubjectName(subjectName);
        capability.setCategoryId(99L);
        capability.setCategoryName("Khoa hoc");
        LearningTutorSearchDataResponse.LevelResponse level = new LearningTutorSearchDataResponse.LevelResponse();
        level.setLevelId(301L);
        level.setLevelName("Lop 12");
        capability.setLevels(List.of(level));
        capability.setExperienceYears(experienceYears);
        capability.setTuitionMin(new BigDecimal(tuitionMin));
        capability.setTuitionMax(new BigDecimal(tuitionMax));
        capability.setDescription("Capability description");
        return capability;
    }

    private LearningTutorSearchDataResponse.AvailabilitySlotResponse availability() {
        LearningTutorSearchDataResponse.AvailabilitySlotResponse availability = new LearningTutorSearchDataResponse.AvailabilitySlotResponse();
        availability.setId(1L);
        availability.setDayOfWeek(2);
        availability.setStartTime("18:00");
        availability.setEndTime("20:00");
        return availability;
    }
}
