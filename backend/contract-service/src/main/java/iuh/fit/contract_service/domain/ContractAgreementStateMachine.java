package iuh.fit.contract_service.domain;

import iuh.fit.contract_service.enums.ContractAgreementStatus;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

public final class ContractAgreementStateMachine {
    private static final Map<ContractAgreementStatus, Set<ContractAgreementStatus>> TRANSITIONS = transitions();

    private ContractAgreementStateMachine() {
    }

    public static void requireTransition(ContractAgreementStatus current, ContractAgreementStatus target) {
        if (!TRANSITIONS.getOrDefault(current, Set.of()).contains(target)) {
            throw new InvalidStateTransitionException(current, target);
        }
    }

    private static Map<ContractAgreementStatus, Set<ContractAgreementStatus>> transitions() {
        Map<ContractAgreementStatus, Set<ContractAgreementStatus>> result =
                new EnumMap<>(ContractAgreementStatus.class);
        result.put(ContractAgreementStatus.DRAFT,
                EnumSet.of(ContractAgreementStatus.PENDING_TUTOR_ACCEPTANCE,
                        ContractAgreementStatus.CANCELLED));
        result.put(ContractAgreementStatus.PENDING_TUTOR_ACCEPTANCE,
                EnumSet.of(ContractAgreementStatus.PENDING_STUDENT_ACCEPTANCE,
                        ContractAgreementStatus.CANCELLED));
        result.put(ContractAgreementStatus.PENDING_STUDENT_ACCEPTANCE,
                EnumSet.of(ContractAgreementStatus.PREPARING_BLOCKCHAIN,
                        ContractAgreementStatus.CANCELLED));
        result.put(ContractAgreementStatus.PREPARING_BLOCKCHAIN,
                EnumSet.of(ContractAgreementStatus.WAITING_PAYMENT,
                        ContractAgreementStatus.CANCELLED));
        result.put(ContractAgreementStatus.WAITING_PAYMENT,
                EnumSet.of(ContractAgreementStatus.PAYMENT_CONFIRMING,
                        ContractAgreementStatus.EXPIRED,
                        ContractAgreementStatus.CANCELLED));
        result.put(ContractAgreementStatus.PAYMENT_CONFIRMING,
                EnumSet.of(ContractAgreementStatus.ACTIVE,
                        ContractAgreementStatus.WAITING_PAYMENT,
                        ContractAgreementStatus.EXPIRED,
                        ContractAgreementStatus.CANCELLED));
        result.put(ContractAgreementStatus.ACTIVE,
                EnumSet.of(ContractAgreementStatus.COMPLETED,
                        ContractAgreementStatus.CANCELLED));
        return Map.copyOf(result);
    }
}
