package iuh.fit.account_service.dto.tutorapplication;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class TutorApplicationSubjectDtoValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void createRequestRequiresSubjectAndValidMetadata() {
        TutorApplicationSubjectRequest request = new TutorApplicationSubjectRequest();
        request.setOneToOneHourlyRate(BigDecimal.ZERO);
        request.setExperienceYears(-1);
        request.setDescription("x".repeat(1001));

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains(
                        "subjectId",
                        "levels",
                        "oneToOneHourlyRate",
                        "experienceYears",
                        "description"
                );
    }

    @Test
    void updateRequestDoesNotExposeSubjectIdAndValidatesMetadata() {
        assertThat(UpdateTutorApplicationSubjectRequest.class.getDeclaredFields())
                .extracting(java.lang.reflect.Field::getName)
                .containsExactlyInAnyOrder("levels", "oneToOneHourlyRate", "experienceYears", "description")
                .doesNotContain("subjectId", "tutorApplicationId", "userId");

        UpdateTutorApplicationSubjectRequest request = new UpdateTutorApplicationSubjectRequest();
        request.setOneToOneHourlyRate(new BigDecimal("-1"));
        request.setExperienceYears(-1);

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("levels", "oneToOneHourlyRate", "experienceYears");
    }
}
