package iuh.fit.contract_service.blockchain;

import iuh.fit.contract_service.config.BlockchainProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;

import java.math.BigInteger;
import java.net.URI;

import static org.junit.jupiter.api.Assertions.assertEquals;

@EnabledIfEnvironmentVariable(named = "RUN_ANVIL_IT", matches = "true")
class AnvilBlockchainReadGatewayIntegrationTest {
    @Test
    void validatesContractsDeployedOnRealAnvilRpc() {
        String rpcUrl = env("ANVIL_RPC_URL", "http://127.0.0.1:8545");
        String escrow = env("ANVIL_ESCROW_ADDRESS", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
        String token = env("ANVIL_USDC_ADDRESS", "0x5FbDB2315678afecb367f032d93F642f64180aa3");

        BlockchainProperties properties = new BlockchainProperties();
        properties.setEnabled(true);
        properties.setChainId(31_337);
        properties.setRpcUrl(URI.create(rpcUrl));
        properties.setEscrowAddress(escrow);
        properties.setUsdcAddress(token);
        properties.setTokenDecimals(6);

        Web3j web3j = Web3j.build(new HttpService(rpcUrl));
        try {
            EduConnectEscrowReadGateway gateway = new EduConnectEscrowReadGateway(
                    properties,
                    new Web3jBlockchainRpcClient(web3j));

            BlockchainNetworkSnapshot snapshot = gateway.validateConfiguration();

            assertEquals(BigInteger.valueOf(31_337), snapshot.chainId());
            assertEquals(token.toLowerCase(), snapshot.tokenAddress().toLowerCase());
            assertEquals(6, snapshot.tokenDecimals());

            OnChainAgreementSnapshot emptyAgreement = gateway.readAgreement("0x" + "00".repeat(31) + "01");
            assertEquals(OnChainAgreementStatus.NONE, emptyAgreement.status());
            assertEquals(BigInteger.ZERO, emptyAgreement.totalAmount());
        } finally {
            web3j.shutdown();
        }
    }

    private static String env(String name, String fallback) {
        return System.getenv().getOrDefault(name, fallback);
    }
}
