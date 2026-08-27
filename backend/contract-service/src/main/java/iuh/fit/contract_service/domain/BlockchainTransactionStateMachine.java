package iuh.fit.contract_service.domain;

import iuh.fit.contract_service.enums.BlockchainTransactionStatus;

public final class BlockchainTransactionStateMachine {
    private BlockchainTransactionStateMachine() {
    }

    public static void requireTransition(BlockchainTransactionStatus current, BlockchainTransactionStatus target) {
        boolean allowed = switch (current) {
            case CREATED -> target == BlockchainTransactionStatus.DISPATCHING
                    || target == BlockchainTransactionStatus.FAILED;
            case DISPATCHING -> target == BlockchainTransactionStatus.SUBMITTED
                    || target == BlockchainTransactionStatus.FAILED;
            case SUBMITTED -> target == BlockchainTransactionStatus.CONFIRMED
                    || target == BlockchainTransactionStatus.FAILED;
            case FAILED -> target == BlockchainTransactionStatus.CREATED;
            case CONFIRMED -> false;
        };
        if (!allowed) {
            throw new InvalidStateTransitionException(current, target);
        }
    }
}
