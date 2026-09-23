package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.TutorSearchDataDtos;
import iuh.fit.learning_service.enums.TeachingMode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PublicTutorSearchDataServiceTest {
    @Mock
    private JdbcTemplate jdbcTemplate;

    private PublicTutorSearchDataService service;

    @BeforeEach
    void setUp() {
        service = new PublicTutorSearchDataService(jdbcTemplate);
        doAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            RowCallbackHandler handler = invocation.getArgument(1);
            for (Map<String, Object> row : rowsFor(sql)) {
                handler.processRow(resultSet(row));
            }
            return null;
        }).when(jdbcTemplate).query(anyString(), any(RowCallbackHandler.class), any(Object[].class));
    }

    @Test
    void subjectAndLevelFiltersMustMatchTheSameCapability() {
        List<TutorSearchDataDtos.TutorSearchDataResponse> mismatched = service.search(
                List.of(101L),
                null,
                null,
                null,
                12L,
                301L,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );

        assertThat(mismatched).isEmpty();

        List<TutorSearchDataDtos.TutorSearchDataResponse> matched = service.search(
                List.of(101L),
                null,
                null,
                null,
                11L,
                301L,
                null,
                new BigDecimal("200000"),
                new BigDecimal("300000"),
                null,
                3,
                null,
                null,
                null
        );

        assertThat(matched).hasSize(1);
        assertThat(matched.getFirst().subjects()).hasSize(1);
        assertThat(matched.getFirst().subjects().getFirst().subjectName()).isEqualTo("Toan");
        assertThat(matched.getFirst().subjects().getFirst().tuitionMin()).isEqualByComparingTo("200000");
        assertThat(matched.getFirst().startingTuition()).isEqualByComparingTo("200000");
    }

    @Test
    void availabilityMustCoverRequestedIntervalAndPositiveRatingFilterExcludesNoReviewTutor() {
        List<TutorSearchDataDtos.TutorSearchDataResponse> covered = service.search(
                List.of(101L, 102L),
                null,
                null,
                null,
                null,
                null,
                TeachingMode.OFFLINE,
                null,
                null,
                4.0,
                null,
                2,
                "18:00",
                "20:00"
        );

        assertThat(covered).extracting(TutorSearchDataDtos.TutorSearchDataResponse::tutorProfileId)
                .containsExactly(101L);
        assertThat(covered.getFirst().publishedClassCount()).isEqualTo(2);

        List<TutorSearchDataDtos.TutorSearchDataResponse> notCovered = service.search(
                List.of(101L, 102L),
                null,
                null,
                null,
                null,
                null,
                TeachingMode.OFFLINE,
                null,
                null,
                4.0,
                null,
                2,
                "17:00",
                "20:00"
        );

        assertThat(notCovered).isEmpty();
    }

    @Test
    void hierarchyFiltersMustMatchApprovedCapabilities() {
        List<TutorSearchDataDtos.TutorSearchDataResponse> programScope = service.search(
                List.of(101L, 102L),
                1L,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );

        assertThat(programScope).extracting(TutorSearchDataDtos.TutorSearchDataResponse::tutorProfileId)
                .containsExactly(101L, 102L);

        List<TutorSearchDataDtos.TutorSearchDataResponse> primaryScience = service.search(
                List.of(101L, 102L),
                1L,
                10L,
                501L,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );

        assertThat(primaryScience).extracting(TutorSearchDataDtos.TutorSearchDataResponse::tutorProfileId)
                .containsExactly(101L);
        assertThat(primaryScience.getFirst().subjects()).extracting(TutorSearchDataDtos.CapabilityResponse::categoryId)
                .containsOnly(501L);

        List<TutorSearchDataDtos.TutorSearchDataResponse> hierarchyAndSubjectAndLevel = service.search(
                List.of(101L, 102L),
                1L,
                10L,
                501L,
                11L,
                301L,
                null,
                new BigDecimal("200000"),
                new BigDecimal("300000"),
                null,
                3,
                null,
                null,
                null
        );

        assertThat(hierarchyAndSubjectAndLevel).hasSize(1);
        assertThat(hierarchyAndSubjectAndLevel.getFirst().subjects()).hasSize(1);
        assertThat(hierarchyAndSubjectAndLevel.getFirst().subjects().getFirst().subjectId()).isEqualTo(11L);

        List<TutorSearchDataDtos.TutorSearchDataResponse> noApprovedCapabilityInScope = service.search(
                List.of(101L, 102L),
                2L,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );

        assertThat(noApprovedCapabilityInScope).isEmpty();
    }

    private List<Map<String, Object>> rowsFor(String sql) {
        if (sql.contains("FROM tutor_subject_registrations")) {
            return List.of(
                    capabilityRow(1L, 101L, 9001L, "tutor1@gmail.com", 1L, 10L, 11L, "Toan", 501L, "Khoa hoc", 301L, "Lop 12", 4, "200000", "250000"),
                    capabilityRow(2L, 101L, 9001L, "tutor1@gmail.com", 1L, 20L, 12L, "Vat ly", 502L, "Vat ly THCS", 302L, "Lop 8", 5, "250000", "300000"),
                    capabilityRow(3L, 102L, 9002L, "tutor2@gmail.com", 1L, 20L, 11L, "Toan", 502L, "Toan THCS", 301L, "Lop 12", 2, "150000", "190000")
            );
        }
        if (sql.contains("FROM tutor_authorization_teaching_modes")) {
            return List.of(
                    Map.of("user_id", 9001L, "teaching_mode", "ONLINE"),
                    Map.of("user_id", 9001L, "teaching_mode", "OFFLINE"),
                    Map.of("user_id", 9002L, "teaching_mode", "OFFLINE")
            );
        }
        if (sql.contains("FROM tutor_availabilities")) {
            return List.of(
                    Map.of("id", 1L, "tutor_email", "tutor1@gmail.com", "day_of_week", 2, "start_time", "18:00", "end_time", "21:00"),
                    Map.of("id", 2L, "tutor_email", "tutor2@gmail.com", "day_of_week", 2, "start_time", "18:00", "end_time", "20:00")
            );
        }
        if (sql.contains("FROM tutor_reviews")) {
            return List.of(Map.of("tutor_id", 9001L, "average_rating", 4.5, "review_count", 6L));
        }
        if (sql.contains("FROM class_rooms")) {
            return List.of(Map.of("tutor_profile_id", 101L, "class_count", 2L));
        }
        return List.of();
    }

    private Map<String, Object> capabilityRow(Long registrationId, Long tutorProfileId, Long userId, String email,
                                              Long programTypeId, Long educationLevelId,
                                              Long subjectId, String subjectName, Long categoryId, String categoryName,
                                              Long levelId, String levelName, Integer experienceYears,
                                              String tuitionMin, String tuitionMax) {
        return Map.ofEntries(
                Map.entry("registration_id", registrationId),
                Map.entry("tutor_profile_id", tutorProfileId),
                Map.entry("user_id", userId),
                Map.entry("tutor_email", email),
                Map.entry("authorization_updated_at", Timestamp.valueOf("2026-01-01 00:00:00")),
                Map.entry("program_type_id", programTypeId),
                Map.entry("education_level_id", educationLevelId),
                Map.entry("subject_id", subjectId),
                Map.entry("subject_name", subjectName),
                Map.entry("category_id", categoryId),
                Map.entry("category_name", categoryName),
                Map.entry("level_id", levelId),
                Map.entry("level_name", levelName),
                Map.entry("experience_years", experienceYears),
                Map.entry("tuition_min", new BigDecimal(tuitionMin)),
                Map.entry("tuition_max", new BigDecimal(tuitionMax)),
                Map.entry("description", subjectName + " description")
        );
    }

    private ResultSet resultSet(Map<String, Object> row) throws Exception {
        ResultSet resultSet = mock(ResultSet.class);
        AtomicBoolean wasNull = new AtomicBoolean(false);
        when(resultSet.getLong(anyString())).thenAnswer(invocation -> {
            Object value = row.get(invocation.getArgument(0));
            wasNull.set(value == null);
            return value == null ? 0L : ((Number) value).longValue();
        });
        when(resultSet.getInt(anyString())).thenAnswer(invocation -> {
            Object value = row.get(invocation.getArgument(0));
            wasNull.set(value == null);
            return value == null ? 0 : ((Number) value).intValue();
        });
        when(resultSet.getDouble(anyString())).thenAnswer(invocation -> {
            Object value = row.get(invocation.getArgument(0));
            wasNull.set(value == null);
            return value == null ? 0.0 : ((Number) value).doubleValue();
        });
        when(resultSet.getString(anyString())).thenAnswer(invocation -> {
            Object value = row.get(invocation.getArgument(0));
            wasNull.set(value == null);
            return value == null ? null : value.toString();
        });
        when(resultSet.getBigDecimal(anyString())).thenAnswer(invocation -> {
            Object value = row.get(invocation.getArgument(0));
            wasNull.set(value == null);
            return (BigDecimal) value;
        });
        when(resultSet.getTimestamp(anyString())).thenAnswer(invocation -> {
            Object value = row.get(invocation.getArgument(0));
            wasNull.set(value == null);
            return (Timestamp) value;
        });
        when(resultSet.wasNull()).thenAnswer(invocation -> wasNull.get());
        return resultSet;
    }
}
