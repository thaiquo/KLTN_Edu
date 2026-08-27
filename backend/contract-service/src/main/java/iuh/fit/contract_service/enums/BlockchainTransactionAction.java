package iuh.fit.contract_service.enums;

public enum BlockchainTransactionAction {
    REGISTER(false),
    PROPOSE(true),
    OPEN_DISPUTE(true),
    FINALIZE(true),
    RESOLVE(true),
    CANCEL(false),
    EXPIRE(false);

    private final boolean settlementScoped;

    BlockchainTransactionAction(boolean settlementScoped) {
        this.settlementScoped = settlementScoped;
    }

    public boolean isSettlementScoped() {
        return settlementScoped;
    }
}
