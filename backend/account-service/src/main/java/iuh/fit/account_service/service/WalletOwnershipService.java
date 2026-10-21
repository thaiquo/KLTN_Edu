package iuh.fit.account_service.service;

import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.WalletOwnershipChallenge;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.WalletOwnershipChallengeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;

@Service
public class WalletOwnershipService {
    private final UserRepository users;
    private final WalletOwnershipChallengeRepository challenges;

    public WalletOwnershipService(UserRepository users, WalletOwnershipChallengeRepository challenges) {
        this.users = users;
        this.challenges = challenges;
    }

    public record ChallengeResponse(UUID challengeId, String message, LocalDateTime expiresAt) {}

    @Transactional
    public ChallengeResponse create(String email, String requestedAddress) {
        User user = users.findByEmailIgnoreCase(email).orElseThrow(() -> new BadRequestException("User not found"));
        String address = requestedAddress == null || requestedAddress.isBlank()
                ? user.getWalletAddress() : normalize(requestedAddress);
        if (address == null) throw new BadRequestException("No wallet is linked");
        UUID id = UUID.randomUUID();
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(5);
        String message = "EduConnect wallet ownership\nUser: " + user.getId()
                + "\nWallet: " + address + "\nNonce: " + id + "\nExpires: " + expiresAt;
        challenges.save(new WalletOwnershipChallenge(id, user.getId(), address, message, expiresAt));
        return new ChallengeResponse(id, message, expiresAt);
    }

    @Transactional
    public void verifyAndConsume(String email, String requestedAddress, UUID challengeId, String signature) {
        User user = users.findByEmailIgnoreCase(email).orElseThrow(() -> new BadRequestException("User not found"));
        if (challengeId == null || signature == null || signature.isBlank()) {
            throw new BadRequestException("Wallet challenge and signature are required");
        }
        WalletOwnershipChallenge challenge = challenges.lockById(challengeId)
                .orElseThrow(() -> new BadRequestException("Wallet challenge is invalid"));
        String address = requestedAddress == null || requestedAddress.isBlank()
                ? user.getWalletAddress() : normalize(requestedAddress);
        if (address == null || !user.getId().equals(challenge.getUserId())
                || !address.equals(challenge.getWalletAddress()) || challenge.getConsumedAt() != null
                || !challenge.getExpiresAt().isAfter(LocalDateTime.now())) {
            throw new BadRequestException("Wallet challenge has expired or was already used");
        }
        try {
            String recovered = "0x" + Keys.getAddress(Sign.signedPrefixedMessageToKey(
                    challenge.getChallengeText().getBytes(StandardCharsets.UTF_8),
                    Sign.signatureDataFromHex(signature)));
            if (!address.equalsIgnoreCase(recovered)) {
                throw new BadRequestException("Wallet signature does not match the requested address");
            }
        } catch (BadRequestException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BadRequestException("Invalid wallet signature");
        }
        challenge.consume(LocalDateTime.now());
        challenges.save(challenge);
    }

    public static String normalize(String address) {
        if (address == null || !address.trim().matches("(?i)^0x[a-f0-9]{40}$")) {
            throw new BadRequestException("Invalid Ethereum wallet address");
        }
        return address.trim().toLowerCase(Locale.ROOT);
    }
}
