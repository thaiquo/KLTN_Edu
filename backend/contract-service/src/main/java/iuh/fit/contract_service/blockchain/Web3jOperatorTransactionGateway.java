package iuh.fit.contract_service.blockchain;

import iuh.fit.contract_service.config.OperatorSignerProperties;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.Hash;
import org.web3j.crypto.RawTransaction;
import org.web3j.crypto.TransactionEncoder;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.response.EthBlockNumber;
import org.web3j.protocol.core.methods.response.EthGetTransactionCount;
import org.web3j.protocol.core.methods.response.EthGetTransactionReceipt;
import org.web3j.protocol.core.methods.response.EthGasPrice;
import org.web3j.protocol.core.methods.response.EthSendTransaction;
import org.web3j.utils.Numeric;

import java.io.IOException;
import java.math.BigInteger;
import java.util.Optional;

public class Web3jOperatorTransactionGateway implements OperatorTransactionGateway {
    private final Web3j web3j;
    private final Credentials credentials;
    private final OperatorSignerProperties properties;

    public Web3jOperatorTransactionGateway(
            Web3j web3j,
            Credentials credentials,
            OperatorSignerProperties properties) {
        this.web3j = web3j;
        this.credentials = credentials;
        this.properties = properties;
    }

    @Override
    public PreparedOperatorTransaction prepare(
            long chainId,
            String fromAddress,
            String toAddress,
            String calldata) {
        if (!credentials.getAddress().equalsIgnoreCase(fromAddress)
                || !properties.getAddress().equalsIgnoreCase(fromAddress)) {
            throw new OperatorTransactionException("Intent fromAddress is not the configured operator");
        }
        try {
            EthGetTransactionCount nonceResponse = web3j.ethGetTransactionCount(
                    fromAddress, DefaultBlockParameterName.PENDING).send();
            EthGasPrice gasPriceResponse = web3j.ethGasPrice().send();
            requireNoError(nonceResponse.hasError(), nonceResponse.getError() == null
                    ? null : nonceResponse.getError().getMessage(), "eth_getTransactionCount");
            requireNoError(gasPriceResponse.hasError(), gasPriceResponse.getError() == null
                    ? null : gasPriceResponse.getError().getMessage(), "eth_gasPrice");

            BigInteger nonce = nonceResponse.getTransactionCount();
            RawTransaction rawTransaction = RawTransaction.createTransaction(
                    nonce,
                    gasPriceResponse.getGasPrice(),
                    BigInteger.valueOf(properties.getGasLimit()),
                    toAddress,
                    BigInteger.ZERO,
                    calldata);
            String signed = Numeric.toHexString(TransactionEncoder.signMessage(rawTransaction, chainId, credentials));
            return new PreparedOperatorTransaction(nonce, Hash.sha3(signed), signed);
        } catch (IOException exception) {
            throw new OperatorTransactionException("Cannot prepare operator transaction", exception);
        }
    }

    @Override
    public String broadcast(PreparedOperatorTransaction transaction) {
        try {
            EthSendTransaction response = web3j.ethSendRawTransaction(transaction.signedRawTransaction()).send();
            requireNoError(response.hasError(), response.getError() == null
                    ? null : response.getError().getMessage(), "eth_sendRawTransaction");
            return response.getTransactionHash();
        } catch (IOException exception) {
            throw new OperatorTransactionException("Operator broadcast result is uncertain", exception);
        }
    }

    @Override
    public Optional<BlockchainTransactionReceipt> findReceipt(String transactionHash) {
        try {
            EthGetTransactionReceipt response = web3j.ethGetTransactionReceipt(transactionHash).send();
            requireNoError(response.hasError(), response.getError() == null
                    ? null : response.getError().getMessage(), "eth_getTransactionReceipt");
            return response.getTransactionReceipt().map(receipt -> new BlockchainTransactionReceipt(
                    receipt.getTransactionHash(),
                    receipt.isStatusOK(),
                    receipt.getBlockNumber().longValueExact(),
                    receipt.getBlockHash()));
        } catch (IOException exception) {
            throw new OperatorTransactionException("Cannot read operator transaction receipt", exception);
        }
    }

    @Override
    public BigInteger latestBlockNumber() {
        try {
            EthBlockNumber response = web3j.ethBlockNumber().send();
            requireNoError(response.hasError(), response.getError() == null
                    ? null : response.getError().getMessage(), "eth_blockNumber");
            return response.getBlockNumber();
        } catch (IOException exception) {
            throw new OperatorTransactionException("Cannot read latest block number", exception);
        }
    }

    private static void requireNoError(boolean hasError, String message, String method) {
        if (hasError) {
            throw new OperatorTransactionException(method + " failed: " + message);
        }
    }
}
