package iuh.fit.learning_service.service;

import iuh.fit.learning_service.dto.StudentMatchingDtos.PreferredScheduleRequest;
import iuh.fit.learning_service.dto.StudentMatchingDtos.StudentMatchingInputRequest;
import iuh.fit.learning_service.entity.CatalogLevel;
import iuh.fit.learning_service.entity.CatalogSubject;
import iuh.fit.learning_service.enums.LevelType;
import iuh.fit.learning_service.enums.TeachingMode;
import iuh.fit.learning_service.exception.BadRequestException;
import iuh.fit.learning_service.repository.CatalogLevelRepository;
import iuh.fit.learning_service.repository.CatalogSubjectRepository;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentMatchingInputServiceTest {
    @Mock
    private CatalogSubjectRepository subjects;

    @Mock
    private CatalogLevelRepository levels;

    private StudentMatchingInputService service;
    private Validator validator;

    @BeforeEach
    void setUp() {
        service = new StudentMatchingInputService(subjects, levels);
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void validInputNormalizesMultipleSchedules() {
        CatalogSubject subject = subject(5L);
        CatalogLevel level = level(9L, subject);
        when(subjects.findByIdAndActiveTrue(5L)).thenReturn(Optional.of(subject));
        when(levels.findByIdAndActiveTrue(9L)).thenReturn(Optional.of(level));

        var request = request(
                5L,
                9L,
                TeachingMode.OFFLINE,
                new BigDecimal("200000"),
                new BigDecimal("300000"),
                "79",
                "26734",
                List.of(slot(4, "18:00", "20:00"), slot(2, "18:00", "20:00")),
                "Ôn thi tốt nghiệp THPT"
        );

        var response = service.validate(request);

        assertThat(response.status()).isEqualTo("VALIDATED");
        assertThat(response.subjectId()).isEqualTo(5L);
        assertThat(response.levelId()).isEqualTo(9L);
        assertThat(response.preferredSchedules())
                .extracting(PreferredScheduleRequest::dayOfWeek)
                .containsExactly(2, 4);
    }

    @Test
    void missingRequiredFieldsFailsBeanValidation() {
        var request = request(null, null, null, null, null, null, null, List.of(), null);

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("subjectId", "levelId", "teachingMode");
    }

    @Test
    void invalidBudgetRangeFailsBeanValidation() {
        var request = request(
                5L,
                9L,
                TeachingMode.ONLINE,
                new BigDecimal("300000"),
                new BigDecimal("200000"),
                null,
                null,
                List.of(),
                null
        );

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("budgetRangeValid");
    }

    @Test
    void invalidScheduleTimeFailsBeanValidation() {
        var request = request(
                5L,
                9L,
                TeachingMode.ONLINE,
                null,
                null,
                null,
                null,
                List.of(slot(2, "20:00", "18:00")),
                null
        );

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("preferredSchedules[0].timeRangeValid");
    }

    @Test
    void onlineWithoutLocationIsAccepted() {
        CatalogSubject subject = subject(5L);
        CatalogLevel level = level(9L, subject);
        when(subjects.findByIdAndActiveTrue(5L)).thenReturn(Optional.of(subject));
        when(levels.findByIdAndActiveTrue(9L)).thenReturn(Optional.of(level));

        var response = service.validate(request(5L, 9L, TeachingMode.ONLINE, null, null, null, null, List.of(), null));

        assertThat(response.provinceCode()).isNull();
        assertThat(response.communeCode()).isNull();
        assertThat(response.notices()).contains("ONLINE không yêu cầu khu vực học trực tiếp.");
    }

    @Test
    void duplicateScheduleIsRejected() {
        CatalogSubject subject = subject(5L);
        CatalogLevel level = level(9L, subject);
        when(subjects.findByIdAndActiveTrue(5L)).thenReturn(Optional.of(subject));
        when(levels.findByIdAndActiveTrue(9L)).thenReturn(Optional.of(level));

        var request = request(
                5L,
                9L,
                TeachingMode.ONLINE,
                null,
                null,
                null,
                null,
                List.of(slot(2, "18:00", "20:00"), slot(2, "18:00", "20:00")),
                null
        );

        assertThatThrownBy(() -> service.validate(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("không được trùng nhau");
    }

    @Test
    void overlappingScheduleIsRejected() {
        CatalogSubject subject = subject(5L);
        CatalogLevel level = level(9L, subject);
        when(subjects.findByIdAndActiveTrue(5L)).thenReturn(Optional.of(subject));
        when(levels.findByIdAndActiveTrue(9L)).thenReturn(Optional.of(level));

        var request = request(
                5L,
                9L,
                TeachingMode.ONLINE,
                null,
                null,
                null,
                null,
                List.of(slot(2, "18:00", "20:00"), slot(2, "19:30", "21:00")),
                null
        );

        assertThatThrownBy(() -> service.validate(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("không được chồng lấn");
    }

    @Test
    void levelMustBelongToSelectedSubject() {
        CatalogSubject selectedSubject = subject(5L);
        CatalogSubject otherSubject = subject(6L);
        CatalogLevel level = level(9L, otherSubject);
        when(subjects.findByIdAndActiveTrue(5L)).thenReturn(Optional.of(selectedSubject));
        when(levels.findByIdAndActiveTrue(9L)).thenReturn(Optional.of(level));

        var request = request(5L, 9L, TeachingMode.ONLINE, null, null, null, null, List.of(), null);

        assertThatThrownBy(() -> service.validate(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("không thuộc môn học");
    }

    private StudentMatchingInputRequest request(
            Long subjectId,
            Long levelId,
            TeachingMode teachingMode,
            BigDecimal budgetMin,
            BigDecimal budgetMax,
            String provinceCode,
            String communeCode,
            List<PreferredScheduleRequest> preferredSchedules,
            String learningGoal
    ) {
        return new StudentMatchingInputRequest(
                subjectId,
                levelId,
                teachingMode,
                budgetMin,
                budgetMax,
                provinceCode,
                communeCode,
                preferredSchedules,
                learningGoal
        );
    }

    private PreferredScheduleRequest slot(int dayOfWeek, String startTime, String endTime) {
        return new PreferredScheduleRequest(dayOfWeek, startTime, endTime);
    }

    private CatalogSubject subject(Long id) {
        CatalogSubject subject = new CatalogSubject();
        subject.setId(id);
        subject.setCode("SUBJECT_" + id);
        subject.setName("Môn " + id);
        subject.setActive(true);
        return subject;
    }

    private CatalogLevel level(Long id, CatalogSubject subject) {
        CatalogLevel level = new CatalogLevel();
        level.setId(id);
        level.setSubject(subject);
        level.setCode("LEVEL_" + id);
        level.setName("Lớp " + id);
        level.setType(LevelType.GRADE);
        level.setActive(true);
        return level;
    }
}
