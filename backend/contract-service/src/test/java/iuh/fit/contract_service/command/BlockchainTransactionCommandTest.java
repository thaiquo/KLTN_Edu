package iuh.fit.contract_service.command;

import iuh.fit.contract_service.enums.BlockchainTransactionAction;
import org.junit.jupiter.api.Test;
import org.web3j.crypto.Hash;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class BlockchainTransactionCommandTest {
    private static final String FROM = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    private static final String TO = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    private static final String CALLDATA = "0x1234";
    private static final String HASH = Hash.sha3(CALLDATA);

    @Test
    void normalizesPublicHexFieldsAndAcceptsCanonicalRegisterKey() {
        UUID agreementId = UUID.randomUUID();
        BlockchainTransactionCommand command = new BlockchainTransactionCommand(
                "REGISTER:31337:" + agreementId,
                BlockchainTransactionAction.REGISTER,
                31_337,
                FROM,
                TO,
                CALLDATA,
                HASH.toUpperCase().replace("0X", "0x"),
                agreementId,
                null,
                "correlation-1");

        assertEquals(FROM.toLowerCase(), command.fromAddress());
        assertEquals(TO.toLowerCase(), command.toAddress());
        assertEquals(HASH, command.calldataHash());
    }

    @Test
    void rejectsWrongIdempotencyKeyAndInvalidHexBeforeWritingDatabase() {
        UUID agreementId = UUID.randomUUID();

        assertThrows(IllegalArgumentException.class, () -> new BlockchainTransactionCommand(
                "REGISTER:1:wrong-agreement",
                BlockchainTransactionAction.REGISTER,
                31_337,
                FROM,
                TO,
                CALLDATA,
                HASH,
                agreementId,
                null,
                null));
        assertThrows(IllegalArgumentException.class, () -> new BlockchainTransactionCommand(
                "REGISTER:31337:" + agreementId,
                BlockchainTransactionAction.REGISTER,
                31_337,
                "not-an-address",
                TO,
                CALLDATA,
                HASH,
                agreementId,
                null,
                null));
    }

    @Test
    void requiresSettlementScopeForSessionAction() {
        UUID agreementId = UUID.randomUUID();

        assertThrows(NullPointerException.class, () -> new BlockchainTransactionCommand(
                "FINALIZE:31337:" + agreementId + ":session-1",
                BlockchainTransactionAction.FINALIZE,
                31_337,
                FROM,
                TO,
                CALLDATA,
                HASH,
                agreementId,
                null,
                null));
    }

    @Test
    void acceptsContractCalldataLongerThanBytes32WhenHashMatches() {
        UUID agreementId = UUID.randomUUID();
        String registerCalldata = "0x" + "12".repeat(228);

        BlockchainTransactionCommand command = new BlockchainTransactionCommand(
                "REGISTER:31337:" + agreementId,
                BlockchainTransactionAction.REGISTER,
                31_337,
                FROM,
                TO,
                registerCalldata,
                Hash.sha3(registerCalldata),
                agreementId,
                null,
                null);

        assertEquals(registerCalldata, command.calldata());
    }
}
