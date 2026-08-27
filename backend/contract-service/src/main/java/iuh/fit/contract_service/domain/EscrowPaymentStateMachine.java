package iuh.fit.contract_service.domain;

import iuh.fit.contract_service.enums.EscrowPaymentStatus;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

public final class EscrowPaymentStateMachine {
    private static final Map<EscrowPaymentStatus, Set<EscrowPaymentStatus>> TRANSITIONS = transitions();

    private EscrowPaymentStateMachine() {
    }

    public static void requireTransition(EscrowPaymentStatus current, EscrowPaymentStatus target) {
        if (!TRANSITIONS.getOrDefault(current, Set.of()).contains(target)) {
            throw new InvalidStateTransitionException(current, target);
        }
    }

    private static Map<EscrowPaymentStatus, Set<EscrowPaymentStatus>> transitions() {
        Map<EscrowPaymentStatus, Set<EscrowPaymentStatus>> result =
                new EnumMap<>(EscrowPaymentStatus.class);
        result.put(EscrowPaymentStatus.NOT_STARTED,
                EnumSet.of(EscrowPaymentStatus.APPROVAL_PENDING,
                        EscrowPaymentStatus.DEPOSIT_PENDING,
                        EscrowPaymentStatus.EXPIRED));
        result.put(EscrowPaymentStatus.APPROVAL_PENDING,
                EnumSet.of(EscrowPaymentStatus.DEPOSIT_PENDING,
                        EscrowPaymentStatus.FAILED_RETRYABLE,
                        EscrowPaymentStatus.EXPIRED));
        result.put(EscrowPaymentStatus.DEPOSIT_PENDING,
                EnumSet.of(EscrowPaymentStatus.CONFIRMING,
                        EscrowPaymentStatus.FAILED_RETRYABLE,
                        EscrowPaymentStatus.EXPIRED));
        result.put(EscrowPaymentStatus.CONFIRMING,
                EnumSet.of(EscrowPaymentStatus.LOCKED,
                        EscrowPaymentStatus.FAILED_RETRYABLE,
                        EscrowPaymentStatus.EXPIRED));
        result.put(EscrowPaymentStatus.FAILED_RETRYABLE,
                EnumSet.of(EscrowPaymentStatus.APPROVAL_PENDING,
                        EscrowPaymentStatus.DEPOSIT_PENDING,
                        EscrowPaymentStatus.CONFIRMING,
                        EscrowPaymentStatus.EXPIRED));
        result.put(EscrowPaymentStatus.LOCKED,
                EnumSet.of(EscrowPaymentStatus.PARTIALLY_RELEASED,
                        EscrowPaymentStatus.SETTLED,
                        EscrowPaymentStatus.REFUNDED));
        result.put(EscrowPaymentStatus.PARTIALLY_RELEASED,
                EnumSet.of(EscrowPaymentStatus.SETTLED,
                        EscrowPaymentStatus.REFUNDED));
        return Map.copyOf(result);
    }
}
