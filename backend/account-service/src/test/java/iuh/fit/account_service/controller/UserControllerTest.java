package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.user.ChangePasswordRequest;
import iuh.fit.account_service.dto.user.UpdateUserProfileRequest;
import iuh.fit.account_service.dto.user.UserProfileResponse;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.TestingAuthenticationToken;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserControllerTest {

    private final UserService userService = mock(UserService.class);
    private final UserController controller = new UserController(userService);

    @Test
    void getCurrentUserUsesAuthenticatedPrincipalEmail() {
        var authentication = new TestingAuthenticationToken("test@example.com", null);
        var profile = profileResponse();
        when(userService.getCurrentUserProfile("test@example.com")).thenReturn(profile);

        var response = controller.getCurrentUser(authentication);

        assertThat(response.getBody()).isSameAs(profile);
        verify(userService).getCurrentUserProfile("test@example.com");
    }

    @Test
    void updateCurrentUserUsesAuthenticatedPrincipalEmail() {
        var authentication = new TestingAuthenticationToken("test@example.com", null);
        var request = new UpdateUserProfileRequest();
        when(userService.updateCurrentUserProfile("test@example.com", request)).thenReturn(profileResponse());

        controller.updateCurrentUser(authentication, request);

        verify(userService).updateCurrentUserProfile("test@example.com", request);
    }

    @Test
    void changePasswordUsesAuthenticatedPrincipalEmail() {
        var authentication = new TestingAuthenticationToken("test@example.com", null);
        var request = new ChangePasswordRequest();

        var response = controller.changePassword(authentication, request);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(userService).changePassword("test@example.com", request);
    }

    @Test
    void updateCurrentUserAvatarUsesAuthenticatedPrincipalEmail() {
        var authentication = new TestingAuthenticationToken("test@example.com", null);
        var file = new MockMultipartFile("file", "avatar.png", "image/png", new byte[] {1, 2, 3});
        var profile = profileResponse();
        when(userService.updateCurrentUserAvatar("test@example.com", file)).thenReturn(profile);

        var response = controller.updateCurrentUserAvatar(authentication, file);

        assertThat(response.getBody()).isSameAs(profile);
        verify(userService).updateCurrentUserAvatar("test@example.com", file);
    }

    private UserProfileResponse profileResponse() {
        return new UserProfileResponse(
                1L,
                "Test User",
                "test@example.com",
                "0912345678",
                LocalDate.of(2000, 1, 1),
                true,
                AccountStatus.ACTIVE,
                List.of("STUDENT", "TUTOR")
        );
    }
}
