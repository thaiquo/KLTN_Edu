package iuh.fit.contract_service.blockchain;

import java.util.List;

public record BlockchainLog(
        String address,
        List<String> topics,
        String data,
        long blockNumber,
        String blockHash,
        String transactionHash,
        long logIndex) {
    public BlockchainLog {
        topics = List.copyOf(topics);
    }
}
