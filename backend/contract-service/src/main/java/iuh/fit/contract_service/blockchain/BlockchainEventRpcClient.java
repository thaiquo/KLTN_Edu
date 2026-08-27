package iuh.fit.contract_service.blockchain;

import java.math.BigInteger;
import java.util.List;

public interface BlockchainEventRpcClient {
    BigInteger getChainId();

    BigInteger getLatestBlockNumber();

    BlockchainBlock getBlock(long blockNumber);

    List<BlockchainLog> getLogs(long fromBlock, long toBlock, String contractAddress);
}
