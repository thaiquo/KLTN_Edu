package iuh.fit.contract_service.blockchain;

import org.web3j.abi.datatypes.Function;

import java.math.BigInteger;

public interface BlockchainRpcClient {
    BigInteger getChainId();

    String getCode(String address);

    String ethCall(String contractAddress, Function function);
}
