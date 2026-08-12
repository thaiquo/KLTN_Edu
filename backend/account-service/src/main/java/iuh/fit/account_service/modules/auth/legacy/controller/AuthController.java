package iuh.fit.account_service.modules.auth.legacy.controller;

import iuh.fit.account_service.modules.auth.legacy.dto.RegisterRequest;
import iuh.fit.account_service.modules.auth.legacy.dto.RegisterResponse;
import iuh.fit.account_service.modules.auth.legacy.dto.VerifyEmailRequest;
import iuh.fit.account_service.modules.auth.legacy.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        RegisterResponse response = authService.register(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @PostMapping("/verify-email")
    public ResponseEntity<String> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        authService.verifyEmail(request);

        return ResponseEntity.ok("Email verified successfully");
    }
}
