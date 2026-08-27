package iuh.fit.contract_service.blockchain;

import iuh.fit.contract_service.config.OperatorSignerProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.Keys;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.http.HttpService;

import java.math.BigInteger;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfEnvironmentVariable(named = "RUN_ANVIL_WRITE_IT", matches = "true")
class AnvilOperatorTransactionGatewayIntegrationTest {
    @Test
    void signsBroadcastsAndReadsReceiptOnRealAnvil() throws Exception {
        String rpcUrl = System.getenv().getOrDefault("ANVIL_RPC_URL", "http://127.0.0.1:8545");
        Web3j web3j = Web3j.build(new HttpService(rpcUrl));
        try {
            Credentials credentials = Credentials.create(Keys.createEcKeyPair());
            fundEphemeralOperator(web3j, credentials.getAddress());

            OperatorSignerProperties properties = new OperatorSignerProperties();
            properties.setAddress(credentials.getAddress());
            properties.setGasLimit(21_000);
            Web3jOperatorTransactionGateway gateway = new Web3jOperatorTransactionGateway(
                    web3j, credentials, properties);

            PreparedOperatorTransaction prepared = gateway.prepare(
                    31_337,
                    credentials.getAddress(),
                    credentials.getAddress(),
                    "0x");
            String transactionHash = gateway.broadcast(prepared);

            BlockchainTransactionReceipt receipt = waitForReceipt(gateway, transactionHash);
            assertEquals(prepared.transactionHash(), transactionHash);
            assertTrue(receipt.successful());
            assertTrue(receipt.blockNumber() > 0);
        } finally {
            web3j.shutdown();
        }
    }

    private static void fundEphemeralOperator(Web3j web3j, String recipient) throws Exception {
        String unlockedAnvilAccount = web3j.ethAccounts().send().getAccounts().getFirst();
        BigInteger gasPrice = web3j.ethGasPrice().send().getGasPrice();
        var response = web3j.ethSendTransaction(Transaction.createEtherTransaction(
                unlockedAnvilAccount,
                null,
                gasPrice,
                BigInteger.valueOf(21_000),
                recipient,
                BigInteger.TEN.pow(18))).send();
        if (response.hasError()) {
            throw new IllegalStateException("Cannot fund ephemeral Anvil operator: "
                    + response.getError().getMessage());
        }
    }

    private static BlockchainTransactionReceipt waitForReceipt(
            OperatorTransactionGateway gateway,
            String transactionHash) throws Exception {
        long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
        while (System.nanoTime() < deadline) {
            var receipt = gateway.findReceipt(transactionHash);
            if (receipt.isPresent()) {
                return receipt.get();
            }
            Thread.sleep(50);
        }
        throw new IllegalStateException("Timed out waiting for local Anvil receipt");
    }
}
