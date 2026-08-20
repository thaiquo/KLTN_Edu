package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.user.AdminUserDetailResponse;
import iuh.fit.account_service.dto.user.AdminUserResponse;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.service.AdminUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/admin/users", "/api/users/admin", "/api/staff/users"})
@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public ResponseEntity<List<AdminUserResponse>> listUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(adminUserService.listUsers(search, role, status));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<AdminUserDetailResponse> getUserDetail(@PathVariable Long userId) {
        return ResponseEntity.ok(adminUserService.getUserDetail(userId));
    }

    @PatchMapping("/{userId}/status")
    public ResponseEntity<AdminUserResponse> updateUserStatus(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body
    ) {
        String statusStr = body.get("status");
        AccountStatus status = AccountStatus.valueOf(statusStr.toUpperCase());
        return ResponseEntity.ok(adminUserService.updateUserStatus(userId, status));
    }
}
