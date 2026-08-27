package iuh.fit.contract_service.blockchain;

import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint32;
import org.web3j.abi.datatypes.generated.Uint8;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

public final class EduConnectEscrowCalldataEncoder {
    private static final Pattern ADDRESS_PATTERN = Pattern.compile("^0x[0-9a-fA-F]{40}$");
    private static final Pattern BYTES32_PATTERN = Pattern.compile("^0x[0-9a-fA-F]{64}$");

    private EduConnectEscrowCalldataEncoder() {}

    public static String encodeRegisterAgreement(
            String agreementIdHex,
            String studentAddress,
            String tutorAddress,
            String termsHashHex,
            BigInteger totalAmountUsdcUnits,
            BigInteger pricePerSessionUsdcUnits,
            long totalSessions) {

        String cleanAgreementId = validateHex(agreementIdHex, "agreementIdHex", BYTES32_PATTERN);
        String cleanStudent = validateHex(studentAddress, "studentAddress", ADDRESS_PATTERN);
        String cleanTutor = validateHex(tutorAddress, "tutorAddress", ADDRESS_PATTERN);
        String cleanTermsHash = validateHex(termsHashHex, "termsHashHex", BYTES32_PATTERN);

        if (cleanStudent.equalsIgnoreCase(cleanTutor)) {
            throw new IllegalArgumentException("Student and tutor addresses must not be equal");
        }
        if (totalAmountUsdcUnits == null || totalAmountUsdcUnits.compareTo(BigInteger.ZERO) <= 0) {
            throw new IllegalArgumentException("totalAmountUsdcUnits must be positive");
        }
        if (pricePerSessionUsdcUnits == null || pricePerSessionUsdcUnits.compareTo(BigInteger.ZERO) <= 0) {
            throw new IllegalArgumentException("pricePerSessionUsdcUnits must be positive");
        }
        if (totalSessions <= 0 || totalSessions > 4_294_967_295L) {
            throw new IllegalArgumentException("totalSessions must be positive and fit within uint32");
        }
        if (!pricePerSessionUsdcUnits.multiply(BigInteger.valueOf(totalSessions)).equals(totalAmountUsdcUnits)) {
            throw new IllegalArgumentException("totalAmountUsdcUnits does not match pricePerSessionUsdcUnits * totalSessions");
        }

        Function function = new Function(
                "registerAgreement",
                List.of(
                        new Bytes32(Numeric.hexStringToByteArray(cleanAgreementId)),
                        new Address(cleanStudent),
                        new Address(cleanTutor),
                        new Bytes32(Numeric.hexStringToByteArray(cleanTermsHash)),
                        new Uint256(totalAmountUsdcUnits),
                        new Uint256(pricePerSessionUsdcUnits),
                        new Uint32(totalSessions)),
                List.of());

        return FunctionEncoder.encode(function);
    }

    public static String encodeFundAgreement(String agreementIdHex) {
        String cleanAgreementId = validateHex(agreementIdHex, "agreementIdHex", BYTES32_PATTERN);
        Function function = new Function(
                "fundAgreement",
                List.of(new Bytes32(Numeric.hexStringToByteArray(cleanAgreementId))),
                List.of());
        return FunctionEncoder.encode(function);
    }

    public static String encodeProposeSessionSettlement(
            String agreementIdHex,
            String sessionIdHex,
            int outcome,
            String evidenceHashHex) {
        String cleanAgreementId = validateHex(agreementIdHex, "agreementIdHex", BYTES32_PATTERN);
        String cleanSessionId = validateHex(sessionIdHex, "sessionIdHex", BYTES32_PATTERN);
        String cleanEvidenceHash = validateHex(evidenceHashHex, "evidenceHashHex", BYTES32_PATTERN);
        if (outcome < 0 || outcome > 2) {
            throw new IllegalArgumentException("outcome must be between 0 and 2");
        }

        Function function = new Function(
                "proposeSessionSettlement",
                List.of(
                        new Bytes32(Numeric.hexStringToByteArray(cleanAgreementId)),
                        new Bytes32(Numeric.hexStringToByteArray(cleanSessionId)),
                        new Uint8(outcome),
                        new Bytes32(Numeric.hexStringToByteArray(cleanEvidenceHash))),
                List.of());
        return FunctionEncoder.encode(function);
    }

    public static String encodeFinalizeSession(String agreementIdHex, String sessionIdHex) {
        String cleanAgreementId = validateHex(agreementIdHex, "agreementIdHex", BYTES32_PATTERN);
        String cleanSessionId = validateHex(sessionIdHex, "sessionIdHex", BYTES32_PATTERN);

        Function function = new Function(
                "finalizeSession",
                List.of(
                        new Bytes32(Numeric.hexStringToByteArray(cleanAgreementId)),
                        new Bytes32(Numeric.hexStringToByteArray(cleanSessionId))),
                List.of());
        return FunctionEncoder.encode(function);
    }

    public static String encodeOpenTutorFraudDispute(
            String agreementIdHex,
            String sessionIdHex,
            String evidenceHashHex) {
        String cleanAgreementId = validateHex(agreementIdHex, "agreementIdHex", BYTES32_PATTERN);
        String cleanSessionId = validateHex(sessionIdHex, "sessionIdHex", BYTES32_PATTERN);
        String cleanEvidenceHash = validateHex(evidenceHashHex, "evidenceHashHex", BYTES32_PATTERN);

        Function function = new Function(
                "openTutorFraudDispute",
                List.of(
                        new Bytes32(Numeric.hexStringToByteArray(cleanAgreementId)),
                        new Bytes32(Numeric.hexStringToByteArray(cleanSessionId)),
                        new Bytes32(Numeric.hexStringToByteArray(cleanEvidenceHash))),
                List.of());
        return FunctionEncoder.encode(function);
    }

    public static String encodeResolveTutorFraudDispute(
            String agreementIdHex,
            String sessionIdHex,
            boolean complaintApproved,
            String resolutionHashHex) {
        String cleanAgreementId = validateHex(agreementIdHex, "agreementIdHex", BYTES32_PATTERN);
        String cleanSessionId = validateHex(sessionIdHex, "sessionIdHex", BYTES32_PATTERN);
        String cleanResolutionHash = validateHex(resolutionHashHex, "resolutionHashHex", BYTES32_PATTERN);

        Function function = new Function(
                "resolveTutorFraudDispute",
                List.of(
                        new Bytes32(Numeric.hexStringToByteArray(cleanAgreementId)),
                        new Bytes32(Numeric.hexStringToByteArray(cleanSessionId)),
                        new org.web3j.abi.datatypes.Bool(complaintApproved),
                        new Bytes32(Numeric.hexStringToByteArray(cleanResolutionHash))),
                List.of());
        return FunctionEncoder.encode(function);
    }

    private static String validateHex(String value, String name, Pattern pattern) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
        String trimmed = value.trim();
        if (!pattern.matcher(trimmed).matches()) {
            throw new IllegalArgumentException(name + " has invalid format");
        }
        return trimmed.toLowerCase(Locale.ROOT);
    }
}
