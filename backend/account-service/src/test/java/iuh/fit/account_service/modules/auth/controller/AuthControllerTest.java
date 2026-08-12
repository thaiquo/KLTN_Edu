package iuh.fit.account_service.modules.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.account_service.modules.auth.dto.response.AccountProfileResponse;
import iuh.fit.account_service.modules.auth.dto.response.AccountResponse;
import iuh.fit.account_service.modules.auth.dto.response.AuthResponseBody;
import iuh.fit.account_service.modules.auth.dto.response.MessageResponse;
import iuh.fit.account_service.modules.auth.service.AuthService;
import iuh.fit.account_service.infrastructure.config.CookieProperties;
import iuh.fit.account_service.infrastructure.security.JwtAuthenticationFilter;
import iuh.fit.account_service.shared.enums.AccountStatus;
import iuh.fit.account_service.shared.enums.Role;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    AuthService authService;

    @MockBean
    JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockBean
    CookieProperties cookieProperties;

    @Test
    void register_shouldReturnApiResponse() throws Exception {
        AccountResponse account = new AccountResponse(
            UUID.randomUUID(),
            "student@example.com",
            Set.of(Role.STUDENT),
            AccountStatus.PENDING_VERIFICATION,
            null,
            new AccountProfileResponse("Student One", "0900000001", null),
            Instant.now(),
            Instant.now()
        );
        when(authService.register(any())).thenReturn(new AuthResponseBody(account, Role.STUDENT, "Registered successfully. Please verify your email."));

        mockMvc.perform(post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "fullName": "Student One",
                      "email": "student@example.com",
                      "phone": "0900000001",
                      "password": "Password123!",
                      "confirmPassword": "Password123!"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.user.email").value("student@example.com"))
            .andExpect(jsonPath("$.data.message").value("Registered successfully. Please verify your email."));
    }

    @Test
    void login_shouldReturnApiResponse() throws Exception {
        AccountResponse account = new AccountResponse(
            UUID.randomUUID(),
            "student@example.com",
            Set.of(Role.STUDENT),
            AccountStatus.ACTIVE,
            Instant.now(),
            new AccountProfileResponse("Student One", "0900000001", null),
            Instant.now(),
            Instant.now()
        );
        when(authService.login(any(), any(), any(), any())).thenReturn(new AuthResponseBody(account, Role.STUDENT, "Login successful"));

        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "student@example.com",
                      "password": "Password123!"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.user.email").value("student@example.com"))
            .andExpect(jsonPath("$.data.activeRole").value("STUDENT"))
            .andExpect(jsonPath("$.data.message").value("Login successful"));
    }
}
