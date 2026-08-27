package iuh.fit.contract_service.blockchain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint32;
import org.web3j.crypto.Hash;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.http.HttpService;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

@EnabledIfEnvironmentVariable(named = "RUN_ANVIL_EVENT_IT", matches = "true")
class AnvilEscrowEventIngestionIntegrationTest {
    @Test
    void readsAndDecodesAgreementRegisteredFromRealAnvilContract() throws Exception {
        String rpcUrl = System.getenv().getOrDefault("ANVIL_RPC_URL", "http://127.0.0.1:8545");
        String escrow = requiredEnv("ANVIL_ESCROW_ADDRESS");
        Web3j web3j = Web3j.build(new HttpService(rpcUrl));
        try {
            List<String> accounts = web3j.ethAccounts().send().getAccounts();
            String operator = accounts.get(0);
            String student = accounts.get(1);
            String tutor = accounts.get(2);
            String agreementId = Hash.sha3String("event-it-" + UUID.randomUUID());
            String termsHash = Hash.sha3String("terms-v1");
            Function register = new Function(
                    "registerAgreement",
                    List.of(
                            new Bytes32(Numeric.hexStringToByteArray(agreementId)),
                            new Address(student),
                            new Address(tutor),
                            new Bytes32(Numeric.hexStringToByteArray(termsHash)),
                            new Uint256(BigInteger.valueOf(40_000_000)),
                            new Uint256(BigInteger.valueOf(4_000_000)),
                            new Uint32(10)),
                    List.of());
            BigInteger gasPrice = web3j.ethGasPrice().send().getGasPrice();
            var send = web3j.ethSendTransaction(Transaction.createFunctionCallTransaction(
                    operator,
                    null,
                    gasPrice,
                    BigInteger.valueOf(1_500_000),
                    escrow,
                    BigInteger.ZERO,
                    FunctionEncoder.encode(register))).send();
            if (send.hasError()) {
                throw new IllegalStateException("Cannot register Anvil agreement: " + send.getError().getMessage());
            }
            var receipt = web3j.ethGetTransactionReceipt(send.getTransactionHash()).send()
                    .getTransactionReceipt().orElseThrow();

            Web3jBlockchainRpcClient rpcClient = new Web3jBlockchainRpcClient(web3j);
            EduConnectEscrowEventDecoder decoder = new EduConnectEscrowEventDecoder();
            DecodedEscrowEvent decoded = rpcClient.getLogs(
                            receipt.getBlockNumber().longValueExact(),
                            receipt.getBlockNumber().longValueExact(),
                            escrow).stream()
                    .map(decoder::decode)
                    .flatMap(java.util.Optional::stream)
                    .filter(event -> event.type() == EscrowEventType.AGREEMENT_REGISTERED)
                    .findFirst()
                    .orElseThrow();

            assertEquals(agreementId.toLowerCase(), decoded.agreementId());
            assertEquals(student.toLowerCase(), decoded.attributes().get("student"));
            assertEquals(tutor.toLowerCase(), decoded.attributes().get("tutor"));
            assertEquals("40000000", decoded.attributes().get("totalAmount"));
            assertEquals("10", decoded.attributes().get("totalSessions"));
        } finally {
            web3j.shutdown();
        }
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required for the opt-in Anvil event test");
        }
        return value;
    }
}
