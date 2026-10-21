package iuh.fit.account_service.controller;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.enums.AccountStatus;
import iuh.fit.account_service.exception.ConflictException;
import iuh.fit.account_service.exception.ResourceNotFoundException;
import iuh.fit.account_service.exception.UnauthorizedException;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.UserRoleRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/internal/contract-snapshot")
public class InternalContractSnapshotController {
    private final UserRepository users;
    private final UserRoleRepository roles;
    private final SecretKey key;

    public InternalContractSnapshotController(UserRepository users, UserRoleRepository roles,
                                              @Value("${jwt.secret}") String secret) {
        this.users = users;
        this.roles = roles;
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public record PartySnapshot(Long userId, String email, String fullName, String phone,
                                LocalDate dateOfBirth, String address, String walletAddress,
                                List<String> roles) {}

    @GetMapping("/users/{id}")
    public PartySnapshot user(@PathVariable Long id,
                              @RequestHeader(value = "X-Service-Token", required = false) String token) {
        try {
            if (token == null || token.isBlank()) {
                throw new IllegalArgumentException("Missing service token");
            }
            var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            if (!"contract-service".equals(claims.getSubject())
                    || !"contract-snapshot".equals(claims.get("serviceScope", String.class))) {
                throw new IllegalArgumentException("Invalid service scope");
            }
        } catch (Exception exception) {
            throw new UnauthorizedException("Invalid service token");
        }
        User user = users.findById(id).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (!user.isEmailVerified() || user.getAccountStatus() != AccountStatus.ACTIVE) {
            throw new ConflictException("User is not active");
        }
        String address = java.util.stream.Stream.of(user.getAddressDetail(), user.getWard(), user.getCommune(),
                        user.getDistrict(), user.getProvince())
                .filter(part -> part != null && !part.isBlank()).distinct()
                .collect(java.util.stream.Collectors.joining(", "));
        return new PartySnapshot(user.getId(), user.getEmail(), user.getFullName(), user.getPhone(),
                user.getDateOfBirth(), address, user.getWalletAddress(),
                roles.findByUserId(id).stream().map(role -> role.getRole().name()).toList());
    }
}
