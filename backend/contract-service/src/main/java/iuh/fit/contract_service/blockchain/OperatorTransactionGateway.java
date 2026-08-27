package iuh.fit.contract_service.blockchain;

import java.math.BigInteger;
import java.util.Optional;

public interface OperatorTransactionGateway {
    PreparedOperatorTransaction prepare(
            long chainId,
            String fromAddress,
            String toAddress,
            String calldata);

    String broadcast(PreparedOperatorTransaction transaction);

    Optional<BlockchainTransactionReceipt> findReceipt(String transactionHash);

    BigInteger latestBlockNumber();
}
