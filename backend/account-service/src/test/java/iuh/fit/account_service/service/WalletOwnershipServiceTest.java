package iuh.fit.account_service.service;

import iuh.fit.account_service.entity.User;
import iuh.fit.account_service.entity.WalletOwnershipChallenge;
import iuh.fit.account_service.exception.BadRequestException;
import iuh.fit.account_service.repository.UserRepository;
import iuh.fit.account_service.repository.WalletOwnershipChallengeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class WalletOwnershipServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final WalletOwnershipChallengeRepository challenges = mock(WalletOwnershipChallengeRepository.class);
    private final WalletOwnershipService service = new WalletOwnershipService(users, challenges);
    private final User user = new User();

    @BeforeEach
    void setup() {
        user.setId(17L);
        user.setEmail("user@example.com");
        when(users.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));
    }

    @Test
    void challengeIsBoundToUserAndWalletAndExpires() {
        var wallet = Credentials.create(ECKeyPair.create(java.math.BigInteger.valueOf(7))).getAddress();
        var challenge = service.create("user@example.com", wallet);
        assertThat(challenge.message()).contains("User: 17", "Wallet: " + wallet.toLowerCase(), "Nonce: ");
        assertThat(challenge.expiresAt()).isAfter(LocalDateTime.now());
        verify(challenges).save(any(WalletOwnershipChallenge.class));
    }

    @Test
    void validSignatureConsumesOnceAndReplayIsRejected() {
        ECKeyPair key = ECKeyPair.create(java.math.BigInteger.valueOf(7));
        String wallet = Credentials.create(key).getAddress();
        WalletOwnershipChallenge challenge = new WalletOwnershipChallenge(UUID.randomUUID(), 17L,
                wallet.toLowerCase(), "EduConnect test challenge", LocalDateTime.now().plusMinutes(5));
        when(challenges.lockById(challenge.getId())).thenReturn(Optional.of(challenge));
        String signature = sign(challenge.getChallengeText(), key);

        service.verifyAndConsume("user@example.com", wallet, challenge.getId(), signature);
        assertThat(challenge.getConsumedAt()).isNotNull();
        assertThatThrownBy(() -> service.verifyAndConsume("user@example.com", wallet, challenge.getId(), signature))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void wrongSignerAndExpiredChallengeAreRejected() {
        ECKeyPair owner = ECKeyPair.create(java.math.BigInteger.valueOf(7));
        ECKeyPair attacker = ECKeyPair.create(java.math.BigInteger.valueOf(8));
        String wallet = Credentials.create(owner).getAddress();
        WalletOwnershipChallenge challenge = new WalletOwnershipChallenge(UUID.randomUUID(), 17L,
                wallet.toLowerCase(), "EduConnect test challenge", LocalDateTime.now().plusMinutes(5));
        when(challenges.lockById(challenge.getId())).thenReturn(Optional.of(challenge));
        assertThatThrownBy(() -> service.verifyAndConsume("user@example.com", wallet, challenge.getId(),
                sign(challenge.getChallengeText(), attacker))).isInstanceOf(BadRequestException.class);

        WalletOwnershipChallenge expired = new WalletOwnershipChallenge(UUID.randomUUID(), 17L,
                wallet.toLowerCase(), "Expired", LocalDateTime.now().minusSeconds(1));
        when(challenges.lockById(expired.getId())).thenReturn(Optional.of(expired));
        assertThatThrownBy(() -> service.verifyAndConsume("user@example.com", wallet, expired.getId(),
                sign(expired.getChallengeText(), owner))).isInstanceOf(BadRequestException.class);
    }

    private static String sign(String message, ECKeyPair key) {
        var data = Sign.signPrefixedMessage(message.getBytes(StandardCharsets.UTF_8), key);
        return "0x" + Numeric.toHexStringNoPrefix(data.getR())
                + Numeric.toHexStringNoPrefix(data.getS()) + Numeric.toHexStringNoPrefix(data.getV());
    }
}
