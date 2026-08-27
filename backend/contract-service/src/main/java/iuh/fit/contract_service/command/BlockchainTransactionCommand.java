package iuh.fit.contract_service.command;

import iuh.fit.contract_service.enums.BlockchainTransactionAction;

import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;
import org.web3j.crypto.Hash;

public record BlockchainTransactionCommand(
        String idempotencyKey,
        BlockchainTransactionAction action,
        long chainId,
        String fromAddress,
        String toAddress,
        String calldata,
        String calldataHash,
        UUID agreementId,
        UUID settlementId,
        String correlationId) {
    private static final Pattern ADDRESS = Pattern.compile("^0x[0-9a-fA-F]{40}$");
    private static final Pattern BYTES_32 = Pattern.compile("^0x[0-9a-fA-F]{64}$");
    private static final Pattern CALLDATA = Pattern.compile("^0x(?:[0-9a-fA-F]{2})+$");

    public BlockchainTransactionCommand {
        action = Objects.requireNonNull(action, "action must not be null");
        agreementId = Objects.requireNonNull(agreementId, "agreementId must not be null");
        if (chainId <= 0) {
            throw new IllegalArgumentException("chainId must be positive");
        }

        idempotencyKey = requireText(idempotencyKey, "idempotencyKey", 255);
        fromAddress = normalizeHex(fromAddress, "fromAddress", ADDRESS);
        toAddress = normalizeHex(toAddress, "toAddress", ADDRESS);
        calldata = normalizeHex(calldata, "calldata", CALLDATA, 32_768);
        calldataHash = normalizeHex(calldataHash, "calldataHash", BYTES_32);
        if (!Hash.sha3(calldata).equalsIgnoreCase(calldataHash)) {
            throw new IllegalArgumentException("calldataHash does not match calldata");
        }
        correlationId = correlationId == null ? null : requireText(correlationId, "correlationId", 100);

        String requiredPrefix = action + ":" + chainId + ":" + agreementId;
        if (action.isSettlementScoped()) {
            Objects.requireNonNull(settlementId, "settlementId must not be null for " + action);
            if (!idempotencyKey.startsWith(requiredPrefix + ":")
                    || idempotencyKey.length() == requiredPrefix.length() + 1) {
                throw new IllegalArgumentException("idempotencyKey must follow " + requiredPrefix + ":{sessionId}");
            }
        } else {
            if (settlementId != null) {
                throw new IllegalArgumentException("settlementId must be null for " + action);
            }
            if (!idempotencyKey.equals(requiredPrefix)) {
                throw new IllegalArgumentException("idempotencyKey must equal " + requiredPrefix);
            }
        }
    }

    private static String normalizeHex(String value, String field, Pattern pattern) {
        return normalizeHex(value, field, pattern, 66);
    }

    private static String normalizeHex(String value, String field, Pattern pattern, int maxLength) {
        String text = requireText(value, field, maxLength);
        if (!pattern.matcher(text).matches()) {
            throw new IllegalArgumentException(field + " has an invalid hexadecimal format");
        }
        return text.toLowerCase(Locale.ROOT);
    }

    private static String requireText(String value, String field, int maxLength) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        String text = value.trim();
        if (text.length() > maxLength) {
            throw new IllegalArgumentException(field + " exceeds " + maxLength + " characters");
        }
        return text;
    }
}
