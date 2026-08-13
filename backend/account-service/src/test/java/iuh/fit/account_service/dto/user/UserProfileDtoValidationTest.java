package iuh.fit.account_service.dto.user;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class UserProfileDtoValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void updateProfileRequestDoesNotExposeProtectedFields() {
        assertThat(UpdateUserProfileRequest.class.getDeclaredFields())
                .extracting(java.lang.reflect.Field::getName)
                .containsExactlyInAnyOrder(
                        "fullName",
                        "phone",
                        "dateOfBirth",
                        "gender",
                        "provinceCode",
                        "province",
                        "communeCode",
                        "commune",
                        "district",
                        "ward",
                        "addressDetail",
                        "bio"
                )
                .doesNotContain("id", "email", "roles", "accountStatus", "emailVerified", "password", "avatarKey", "avatarUrl");
    }

    @Test
    void changePasswordRequestDoesNotExposeAccountTargetFields() {
        assertThat(ChangePasswordRequest.class.getDeclaredFields())
                .extracting(java.lang.reflect.Field::getName)
                .containsExactlyInAnyOrder("currentPassword", "newPassword", "confirmPassword")
                .doesNotContain("userId", "email", "roles", "accountStatus");
    }

    @Test
    void futureDateOfBirthIsInvalid() {
        UpdateUserProfileRequest request = validUpdateRequest();
        request.setDateOfBirth(LocalDate.now().plusDays(1));

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("dateOfBirth");
    }

    @Test
    void invalidPhoneIsRejected() {
        UpdateUserProfileRequest request = validUpdateRequest();
        request.setPhone("phone-number");

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("phone");
    }

    @Test
    void shortNewPasswordIsInvalid() {
        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setCurrentPassword("oldPassword123");
        request.setNewPassword("short");
        request.setConfirmPassword("short");

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("newPassword");
    }

    private UpdateUserProfileRequest validUpdateRequest() {
        UpdateUserProfileRequest request = new UpdateUserProfileRequest();
        request.setFullName("Test User");
        request.setPhone("+84901234567");
        request.setDateOfBirth(LocalDate.of(2000, 1, 1));
        return request;
    }
}
