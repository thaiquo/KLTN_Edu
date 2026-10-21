package iuh.fit.account_service.controller;

import iuh.fit.account_service.dto.chat.ChatIdentityResponse;
import iuh.fit.account_service.dto.user.ChangePasswordRequest;
import iuh.fit.account_service.dto.user.UpdateUserProfileRequest;
import iuh.fit.account_service.dto.user.UserProfileResponse;
import iuh.fit.account_service.service.AuthCookieService;
import iuh.fit.account_service.service.UserService;
import iuh.fit.account_service.service.WalletOwnershipService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final AuthCookieService authCookieService;
    private final WalletOwnershipService walletOwnershipService;

    public UserController(UserService userService, AuthCookieService authCookieService,
                          WalletOwnershipService walletOwnershipService) {
        this.userService = userService;
        this.authCookieService = authCookieService;
        this.walletOwnershipService = walletOwnershipService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getCurrentUser(Authentication authentication) {
        return ResponseEntity.ok(userService.getCurrentUserProfile(authentication.getName()));
    }

    @GetMapping("/chat-identities/{userId}")
    public ResponseEntity<ChatIdentityResponse> getChatIdentity(@PathVariable Long userId) {
        return ResponseEntity.ok(userService.getChatIdentity(userId));
    }

    @PostMapping("/me/activate-student")
    public ResponseEntity<UserProfileResponse> activateStudentProfile(Authentication authentication) {
        return ResponseEntity.ok(userService.activateStudentProfile(authentication.getName()));
    }

    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateCurrentUser(
            Authentication authentication,
            @Valid @RequestBody UpdateUserProfileRequest request
    ) {
        return ResponseEntity.ok(userService.updateCurrentUserProfile(authentication.getName(), request));
    }

    @PutMapping("/me/wallet")
    public ResponseEntity<UserProfileResponse> updateCurrentUserWallet(
            Authentication authentication,
            @RequestBody WalletUpdateRequest request
    ) {
        walletOwnershipService.verifyAndConsume(
                authentication.getName(), request.walletAddress(), request.challengeId(), request.signature());
        return ResponseEntity.ok(userService.updateCurrentUserWallet(authentication.getName(), request.walletAddress()));
    }

    public record WalletUpdateRequest(String walletAddress, java.util.UUID challengeId, String signature) {}
    public record WalletChallengeRequest(String walletAddress) {}

    @PostMapping("/me/wallet/challenge")
    public WalletOwnershipService.ChallengeResponse walletChallenge(
            Authentication authentication, @RequestBody WalletChallengeRequest request) {
        return walletOwnershipService.create(authentication.getName(), request.walletAddress());
    }

    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserProfileResponse> updateCurrentUserAvatar(
            Authentication authentication,
            @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.ok(userService.updateCurrentUserAvatar(authentication.getName(), file));
    }

    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletResponse response
    ) {
        userService.changePassword(authentication.getName(), request);
        authCookieService.clearAuthCookies(response);
        return ResponseEntity.noContent().build();
    }
}
