package iuh.fit.contract_service.domain;

import iuh.fit.contract_service.enums.BlockchainTransactionStatus;
import iuh.fit.contract_service.enums.ContractAgreementStatus;
import iuh.fit.contract_service.enums.EscrowPaymentStatus;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ContractStateMachineTest {
    @Test
    void allowsCanonicalAgreementLifecycle() {
        assertDoesNotThrow(() -> ContractAgreementStateMachine.requireTransition(
                ContractAgreementStatus.DRAFT,
                ContractAgreementStatus.PENDING_TUTOR_ACCEPTANCE));
        assertDoesNotThrow(() -> ContractAgreementStateMachine.requireTransition(
                ContractAgreementStatus.PAYMENT_CONFIRMING,
                ContractAgreementStatus.ACTIVE));
        assertDoesNotThrow(() -> ContractAgreementStateMachine.requireTransition(
                ContractAgreementStatus.ACTIVE,
                ContractAgreementStatus.COMPLETED));
    }

    @Test
    void rejectsAgreementActivationBeforeConfirmedPayment() {
        assertThrows(InvalidStateTransitionException.class,
                () -> ContractAgreementStateMachine.requireTransition(
                        ContractAgreementStatus.WAITING_PAYMENT,
                        ContractAgreementStatus.ACTIVE));
    }

    @Test
    void paymentCannotBecomeLockedFromTransactionHashAlone() {
        assertThrows(InvalidStateTransitionException.class,
                () -> EscrowPaymentStateMachine.requireTransition(
                        EscrowPaymentStatus.DEPOSIT_PENDING,
                        EscrowPaymentStatus.LOCKED));
        assertDoesNotThrow(() -> EscrowPaymentStateMachine.requireTransition(
                EscrowPaymentStatus.DEPOSIT_PENDING,
                EscrowPaymentStatus.CONFIRMING));
        assertDoesNotThrow(() -> EscrowPaymentStateMachine.requireTransition(
                EscrowPaymentStatus.CONFIRMING,
                EscrowPaymentStatus.LOCKED));
    }

    @Test
    void confirmedBlockchainTransactionIsTerminal() {
        assertThrows(InvalidStateTransitionException.class,
                () -> BlockchainTransactionStateMachine.requireTransition(
                        BlockchainTransactionStatus.CONFIRMED,
                        BlockchainTransactionStatus.SUBMITTED));
    }
}
