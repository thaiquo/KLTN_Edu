package iuh.fit.contract_service.blockchain;

import org.junit.jupiter.api.Test;
import org.web3j.crypto.Hash;

import java.math.BigInteger;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EduConnectEscrowCalldataEncoderTest {

    @Test
    void encodesValidRegisterAgreementCalldata() {
        String agreementIdHex = Hash.sha3String("test-agreement-" + UUID.randomUUID());
        String student = "0x0000000000000000000000000000000000000001";
        String tutor = "0x0000000000000000000000000000000000000002";
        String termsHash = Hash.sha3String("terms-v1");
        BigInteger totalAmount = BigInteger.valueOf(40_000_000);
        BigInteger pricePerSession = BigInteger.valueOf(4_000_000);
        long totalSessions = 10;

        String calldata = EduConnectEscrowCalldataEncoder.encodeRegisterAgreement(
                agreementIdHex, student, tutor, termsHash, totalAmount, pricePerSession, totalSessions);

        assertNotNull(calldata);
        assertTrue(calldata.startsWith("0x"));
        // Method selector for registerAgreement(bytes32,address,address,bytes32,uint256,uint256,uint32)
        // 4 bytes selector + 7 * 32 bytes parameters = 4 + 224 = 228 bytes = 458 hex characters (with '0x')
        assertEquals(458, calldata.length());
    }

    @Test
    void rejectsEqualStudentAndTutor() {
        String agreementIdHex = Hash.sha3String("test-agreement");
        String address = "0x0000000000000000000000000000000000000001";
        String termsHash = Hash.sha3String("terms-v1");

        assertThrows(IllegalArgumentException.class, () ->
                EduConnectEscrowCalldataEncoder.encodeRegisterAgreement(
                        agreementIdHex, address, address, termsHash,
                        BigInteger.valueOf(40_000_000), BigInteger.valueOf(4_000_000), 10));
    }

    @Test
    void rejectsMismatchedTotalAmount() {
        String agreementIdHex = Hash.sha3String("test-agreement");
        String student = "0x0000000000000000000000000000000000000001";
        String tutor = "0x0000000000000000000000000000000000000002";
        String termsHash = Hash.sha3String("terms-v1");

        assertThrows(IllegalArgumentException.class, () ->
                EduConnectEscrowCalldataEncoder.encodeRegisterAgreement(
                        agreementIdHex, student, tutor, termsHash,
                        BigInteger.valueOf(50_000_000), BigInteger.valueOf(4_000_000), 10));
    }
}
