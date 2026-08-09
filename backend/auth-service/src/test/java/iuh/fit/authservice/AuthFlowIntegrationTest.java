package iuh.fit.authservice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.authservice.infrastructure.security.LoginRateLimitService;
import iuh.fit.authservice.modules.auth.entity.Account;
import iuh.fit.authservice.modules.auth.entity.OutboxEvent;
import iuh.fit.authservice.modules.auth.repository.AccountRepository;
import iuh.fit.authservice.modules.auth.repository.OutboxEventRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import jakarta.servlet.http.Cookie;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthFlowIntegrationTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    AccountRepository accountRepository;

    @Autowired
    OutboxEventRepository outboxEventRepository;

    @MockBean
    LoginRateLimitService loginRateLimitService;

    @Test
    void register_verify_login_refresh_me_logout_flow_shouldWork() throws Exception {
        doNothing().when(loginRateLimitService).ensureAllowed(anyString(), anyString());
        doNothing().when(loginRateLimitService).registerFailure(anyString(), anyString());
        doNothing().when(loginRateLimitService).reset(anyString(), anyString());

        String email = "student1@example.com";
        String password = "Password123!";

        mockMvc.perform(post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "fullName": "Student One",
                      "email": "%s",
                      "phone": "0900000001",
                      "password": "%s",
                      "confirmPassword": "%s"
                    }
                    """.formatted(email, password, password)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.user.email").value(email))
            .andExpect(jsonPath("$.data.user.status").value("PENDING_VERIFICATION"));

        Account account = accountRepository.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(account.getStatus()).isEqualTo(iuh.fit.authservice.shared.enums.AccountStatus.PENDING_VERIFICATION);

        String verificationToken = extractVerificationToken(account.getId());

        mockMvc.perform(post("/auth/verify-email")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "token": "%s"
                    }
                    """.formatted(verificationToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.message").value("Email verified successfully"));

        account = accountRepository.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(account.getStatus()).isEqualTo(iuh.fit.authservice.shared.enums.AccountStatus.ACTIVE);

        var loginResult = mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "%s",
                      "password": "%s"
                    }
                    """.formatted(email, password)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.message").value("Login successful"))
            .andExpect(jsonPath("$.data.user.email").value(email))
            .andReturn();

        String accessToken = extractCookieValue(loginResult.getResponse().getHeaders("Set-Cookie"), "access_token");
        String refreshToken = extractCookieValue(loginResult.getResponse().getHeaders("Set-Cookie"), "refresh_token");

        mockMvc.perform(get("/me").cookie(new Cookie("access_token", accessToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.email").value(email))
            .andExpect(jsonPath("$.data.profile.fullName").value("Student One"));

        var refreshResult = mockMvc.perform(post("/auth/refresh")
                .cookie(new Cookie("refresh_token", refreshToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.message").value("Token refreshed successfully"))
            .andReturn();

        String newRefreshToken = extractCookieValue(refreshResult.getResponse().getHeaders("Set-Cookie"), "refresh_token");
        String newAccessToken = extractCookieValue(refreshResult.getResponse().getHeaders("Set-Cookie"), "access_token");
        assertThat(newRefreshToken).isNotBlank().isNotEqualTo(refreshToken);
        assertThat(newAccessToken).isNotBlank();

        var logoutResult = mockMvc.perform(post("/auth/logout")
                .with(csrf())
                .cookie(new Cookie("access_token", newAccessToken))
                .cookie(new Cookie("refresh_token", newRefreshToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.message").value("Logout successful"))
            .andReturn();

        assertThat(logoutResult.getResponse().getHeaders("Set-Cookie")).anyMatch(header -> header.startsWith("access_token="));
        assertThat(loginRateLimitService).isNotNull();
    }

    private String extractVerificationToken(UUID accountId) throws Exception {
        List<OutboxEvent> events = outboxEventRepository.findAll();
        OutboxEvent event = events.stream()
            .filter(item -> "AccountRegistered".equals(item.getEventType()))
            .filter(item -> accountId.equals(item.getAggregateId()))
            .findFirst()
            .orElseThrow();
        JsonNode payload = objectMapper.readTree(event.getPayload());
        return payload.get("verificationToken").asText();
    }

    private String extractCookieValue(List<String> setCookieHeaders, String cookieName) {
        return setCookieHeaders.stream()
            .filter(header -> header.startsWith(cookieName + "="))
            .map(header -> header.substring(0, header.indexOf(';')))
            .map(pair -> pair.substring(cookieName.length() + 1))
            .findFirst()
            .orElseThrow();
    }
}
