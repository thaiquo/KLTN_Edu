package iuh.fit.learning_service.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EnrollmentRequestDtosValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void acceptRequestRequiresSignedAgreementId() {
        var violations = validator.validate(new EnrollmentRequestDtos.AcceptRequestPayload(null));

        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("agreementId");
    }

    @Test
    void acceptRequestRejectsMalformedAgreementId() {
        var violations = validator.validate(new EnrollmentRequestDtos.AcceptRequestPayload("not-an-agreement"));

        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("agreementId");
    }

    @Test
    void acceptRequestAllowsContractAgreementUuid() {
        var violations = validator.validate(new EnrollmentRequestDtos.AcceptRequestPayload(
                "13d401f9-866e-419a-ac94-8091a70cd966"));

        assertThat(violations).isEmpty();
    }
}
