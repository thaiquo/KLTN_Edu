package iuh.fit.account_service.modules.auth.controller;

import iuh.fit.account_service.modules.auth.dto.request.ChangeStatusRequest;
import iuh.fit.account_service.modules.auth.dto.response.AccountResponse;
import iuh.fit.account_service.modules.auth.service.AuthService;
import iuh.fit.account_service.shared.response.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/admin/accounts")
public class AdminAccountController {

    private final AuthService authService;

    public AdminAccountController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    public ApiResponse<Page<AccountResponse>> list(Pageable pageable) {
        return ApiResponse.success(authService.adminListAccounts(pageable));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('STAFF','ADMIN')")
    public ApiResponse<AccountResponse> changeStatus(@PathVariable UUID id, @Valid @RequestBody ChangeStatusRequest request) {
        return ApiResponse.success(authService.adminChangeStatus(id, request));
    }
}