package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.user.AdminUserDetailResponse;
import iuh.fit.account_service.dto.user.AdminUserResponse;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.service.AdminUserService;
import iuh.fit.account_service.dto.user.CreateStaffRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

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
    public ResponseEntity<Page<AdminUserResponse>> listUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(50, Math.max(1, size));
        return ResponseEntity.ok(adminUserService.listUsers(search, role, status,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")))));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getUserStats() {
        return ResponseEntity.ok(adminUserService.getUserStats());
    }

    @GetMapping("/{userId}")
    public ResponseEntity<AdminUserDetailResponse> getUserDetail(@PathVariable Long userId) {
        return ResponseEntity.ok(adminUserService.getUserDetail(userId));
    }

    @PostMapping("/staff")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminUserResponse> createStaff(
            @Valid @RequestBody CreateStaffRequest request
    ) {
        return ResponseEntity.ok(adminUserService.createStaff(request));
    }

    @PatchMapping("/{userId}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminUserResponse> updateUserStatus(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body
    ) {
        String statusStr = body.get("status");
        AccountStatus status = AccountStatus.valueOf(statusStr.toUpperCase());
        return ResponseEntity.ok(adminUserService.updateUserStatus(userId, status));
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminUserResponse> deleteUser(@PathVariable Long userId) {
        return ResponseEntity.ok(adminUserService.deleteUser(userId));
    }
}
