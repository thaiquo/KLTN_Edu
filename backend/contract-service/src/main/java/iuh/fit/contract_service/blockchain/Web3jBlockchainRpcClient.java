package iuh.fit.contract_service.blockchain;

import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.datatypes.Function;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.protocol.core.methods.response.EthGetCode;
import org.web3j.protocol.core.methods.response.EthBlock;
import org.web3j.protocol.core.methods.response.EthBlockNumber;
import org.web3j.protocol.core.methods.response.EthLog;
import org.web3j.protocol.core.methods.response.Log;
import org.web3j.protocol.core.methods.request.EthFilter;
import org.web3j.protocol.core.DefaultBlockParameter;

import java.io.IOException;
import java.math.BigInteger;
import java.util.List;

public class Web3jBlockchainRpcClient implements BlockchainRpcClient, BlockchainEventRpcClient {
    private final Web3j web3j;

    public Web3jBlockchainRpcClient(Web3j web3j) {
        this.web3j = web3j;
    }

    @Override
    public BigInteger getChainId() {
        try {
            return web3j.ethChainId().send().getChainId();
        } catch (IOException exception) {
            throw new BlockchainConfigurationException("Cannot read chain ID from configured RPC", exception);
        }
    }

    @Override
    public String getCode(String address) {
        try {
            EthGetCode response = web3j.ethGetCode(address, DefaultBlockParameterName.LATEST).send();
            if (response.hasError()) {
                throw new BlockchainConfigurationException("eth_getCode failed: " + response.getError().getMessage());
            }
            return response.getCode();
        } catch (IOException exception) {
            throw new BlockchainConfigurationException("Cannot read contract bytecode", exception);
        }
    }

    @Override
    public String ethCall(String contractAddress, Function function) {
        Transaction transaction = Transaction.createEthCallTransaction(
                null,
                contractAddress,
                FunctionEncoder.encode(function));
        try {
            EthCall response = web3j.ethCall(transaction, DefaultBlockParameterName.LATEST).send();
            if (response.hasError()) {
                throw new BlockchainConfigurationException("eth_call failed: " + response.getError().getMessage());
            }
            return response.getValue();
        } catch (IOException exception) {
            throw new BlockchainConfigurationException("Cannot call configured contract", exception);
        }
    }

    @Override
    public BigInteger getLatestBlockNumber() {
        try {
            EthBlockNumber response = web3j.ethBlockNumber().send();
            requireNoError(response.hasError(), response.getError() == null
                    ? null : response.getError().getMessage(), "eth_blockNumber");
            return response.getBlockNumber();
        } catch (IOException exception) {
            throw new BlockchainConfigurationException("Cannot read latest block number", exception);
        }
    }

    @Override
    public BlockchainBlock getBlock(long blockNumber) {
        try {
            EthBlock response = web3j.ethGetBlockByNumber(
                    DefaultBlockParameter.valueOf(BigInteger.valueOf(blockNumber)), false).send();
            requireNoError(response.hasError(), response.getError() == null
                    ? null : response.getError().getMessage(), "eth_getBlockByNumber");
            if (response.getBlock() == null || response.getBlock().getHash() == null) {
                throw new BlockchainConfigurationException("Block is unavailable: " + blockNumber);
            }
            return new BlockchainBlock(
                    response.getBlock().getNumber().longValueExact(),
                    response.getBlock().getHash());
        } catch (IOException exception) {
            throw new BlockchainConfigurationException("Cannot read block " + blockNumber, exception);
        }
    }

    @Override
    public List<BlockchainLog> getLogs(long fromBlock, long toBlock, String contractAddress) {
        EthFilter filter = new EthFilter(
                DefaultBlockParameter.valueOf(BigInteger.valueOf(fromBlock)),
                DefaultBlockParameter.valueOf(BigInteger.valueOf(toBlock)),
                contractAddress);
        try {
            EthLog response = web3j.ethGetLogs(filter).send();
            requireNoError(response.hasError(), response.getError() == null
                    ? null : response.getError().getMessage(), "eth_getLogs");
            return response.getLogs().stream()
                    .map(EthLog.LogResult::get)
                    .map(Log.class::cast)
                    .map(log -> new BlockchainLog(
                            log.getAddress(),
                            log.getTopics(),
                            log.getData(),
                            log.getBlockNumber().longValueExact(),
                            log.getBlockHash(),
                            log.getTransactionHash(),
                            log.getLogIndex().longValueExact()))
                    .toList();
        } catch (IOException exception) {
            throw new BlockchainConfigurationException("Cannot read escrow event logs", exception);
        }
    }

    private static void requireNoError(boolean hasError, String message, String method) {
        if (hasError) {
            throw new BlockchainConfigurationException(method + " failed: " + message);
        }
    }
}
