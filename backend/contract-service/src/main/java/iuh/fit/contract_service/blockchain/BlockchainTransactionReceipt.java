package iuh.fit.contract_service.blockchain;

public record BlockchainTransactionReceipt(
        String transactionHash,
        boolean successful,
        long blockNumber,
        String blockHash) {
}
