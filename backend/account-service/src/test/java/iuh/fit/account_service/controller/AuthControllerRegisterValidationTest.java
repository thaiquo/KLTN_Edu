package iuh.fit.account_service.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import iuh.fit.account_service.dto.auth.RegisterRequest;
import iuh.fit.account_service.exception.GlobalExceptionHandler;
import iuh.fit.account_service.service.AuthCookieService;
import iuh.fit.account_service.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.hasItem;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthControllerRegisterValidationTest {

    private final AuthService authService = mock(AuthService.class);
    private final AuthCookieService authCookieService = mock(AuthCookieService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new AuthController(authService, authCookieService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void invalidEmailReturnsValidationError() throws Exception {
        RegisterRequest request = validRequest();
        request.setEmail("not-an-email");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.validationErrors[*].field", hasItem("email")));

        verifyNoInteractions(authService);
    }

    @Test
    void shortPasswordReturnsValidationError() throws Exception {
        RegisterRequest request = validRequest();
        request.setPassword("123");
        request.setConfirmPassword("123");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.validationErrors[*].field", hasItem("password")));

        verifyNoInteractions(authService);
    }

    @Test
    void blankFullNameReturnsValidationError() throws Exception {
        RegisterRequest request = validRequest();
        request.setFullName(" ");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors[*].field", hasItem("fullName")));

        verifyNoInteractions(authService);
    }

    private RegisterRequest validRequest() {
        RegisterRequest request = new RegisterRequest();
        request.setFullName("Nguyen Van A");
        request.setEmail("test@gmail.com");
        request.setPassword("12345678");
        request.setConfirmPassword("12345678");
        return request;
    }
}
