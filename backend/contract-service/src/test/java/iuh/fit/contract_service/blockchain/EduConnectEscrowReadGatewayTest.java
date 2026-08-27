package iuh.fit.contract_service.blockchain;

import iuh.fit.contract_service.config.BlockchainProperties;
import org.junit.jupiter.api.Test;
import org.web3j.abi.TypeEncoder;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint8;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint32;
import org.web3j.abi.datatypes.generated.Uint64;

import java.math.BigInteger;
import java.net.URI;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EduConnectEscrowReadGatewayTest {
    private static final String ESCROW = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    private static final String TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    private static final String PLATFORM = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    @Test
    void validatesExpectedNetworkAndImmutableContractConfiguration() {
        FakeRpcClient rpc = validRpc();

        BlockchainNetworkSnapshot snapshot = gateway(rpc).validateConfiguration();

        assertEquals(BigInteger.valueOf(31_337), snapshot.chainId());
        assertEquals(TOKEN.toLowerCase(), snapshot.tokenAddress().toLowerCase());
        assertEquals(6, snapshot.tokenDecimals());
        assertEquals(PLATFORM.toLowerCase(), snapshot.platformWallet().toLowerCase());
    }

    @Test
    void rejectsWrongRpcChainBeforeReadingContracts() {
        FakeRpcClient rpc = validRpc();
        rpc.chainId = BigInteger.valueOf(11_155_111);

        assertThrows(BlockchainConfigurationException.class,
                () -> gateway(rpc).validateConfiguration());
    }

    @Test
    void rejectsAddressWithoutDeployedBytecode() {
        FakeRpcClient rpc = validRpc();
        rpc.escrowCode = "0x";

        assertThrows(BlockchainConfigurationException.class,
                () -> gateway(rpc).validateConfiguration());
    }

    @Test
    void rejectsEscrowBoundToDifferentToken() {
        FakeRpcClient rpc = validRpc();
        rpc.escrowToken = "0x0000000000000000000000000000000000000001";

        assertThrows(BlockchainConfigurationException.class,
                () -> gateway(rpc).validateConfiguration());
    }

    @Test
    void rejectsUnexpectedTokenDecimals() {
        FakeRpcClient rpc = validRpc();
        rpc.decimals = 18;

        assertThrows(BlockchainConfigurationException.class,
                () -> gateway(rpc).validateConfiguration());
    }

    @Test
    void readsCompleteAgreementSnapshotWithoutSendingTransaction() {
        OnChainAgreementSnapshot agreement = gateway(validRpc()).readAgreement("0x" + "11".repeat(32));

        assertEquals(PLATFORM.toLowerCase(), agreement.student().toLowerCase());
        assertEquals(TOKEN.toLowerCase(), agreement.tutor().toLowerCase());
        assertEquals(BigInteger.valueOf(40_000_000), agreement.totalAmount());
        assertEquals(BigInteger.valueOf(4_000_000), agreement.pricePerSession());
        assertEquals(BigInteger.TEN, agreement.totalSessions());
        assertEquals(OnChainAgreementStatus.FUNDED, agreement.status());
    }

    private static EduConnectEscrowReadGateway gateway(FakeRpcClient rpc) {
        BlockchainProperties properties = new BlockchainProperties();
        properties.setEnabled(true);
        properties.setChainId(31_337);
        properties.setRpcUrl(URI.create("http://127.0.0.1:8545"));
        properties.setEscrowAddress(ESCROW);
        properties.setUsdcAddress(TOKEN);
        properties.setTokenDecimals(6);
        return new EduConnectEscrowReadGateway(properties, rpc);
    }

    private static FakeRpcClient validRpc() {
        FakeRpcClient rpc = new FakeRpcClient();
        rpc.chainId = BigInteger.valueOf(31_337);
        rpc.escrowCode = "0x60016000";
        rpc.tokenCode = "0x60026000";
        rpc.escrowToken = TOKEN;
        rpc.platformWallet = PLATFORM;
        rpc.decimals = 6;
        return rpc;
    }

    private static final class FakeRpcClient implements BlockchainRpcClient {
        private BigInteger chainId;
        private String escrowCode;
        private String tokenCode;
        private String escrowToken;
        private String platformWallet;
        private int decimals;

        @Override
        public BigInteger getChainId() {
            return chainId;
        }

        @Override
        public String getCode(String address) {
            return address.equalsIgnoreCase(ESCROW) ? escrowCode : tokenCode;
        }

        @Override
        public String ethCall(String contractAddress, Function function) {
            return switch (function.getName()) {
                case "usdc" -> encode(new Address(escrowToken));
                case "platformWallet" -> encode(new Address(platformWallet));
                case "decimals" -> encode(new Uint8(BigInteger.valueOf(decimals)));
                case "getAgreement" -> encode(
                        new Address(PLATFORM),
                        new Address(TOKEN),
                        new Bytes32(new byte[32]),
                        new Uint256(BigInteger.valueOf(40_000_000)),
                        new Uint256(BigInteger.valueOf(4_000_000)),
                        new Uint256(BigInteger.valueOf(40_000_000)),
                        new Uint256(BigInteger.ZERO),
                        new Uint256(BigInteger.ZERO),
                        new Uint64(BigInteger.valueOf(1_800_000_000L)),
                        new Uint32(BigInteger.TEN),
                        new Uint32(BigInteger.ZERO),
                        new Uint32(BigInteger.ZERO),
                        new Uint8(BigInteger.valueOf(2)));
                default -> throw new AssertionError("Unexpected function " + function.getName());
            };
        }

        private static String encode(Type<?>... values) {
            StringBuilder encoded = new StringBuilder("0x");
            for (Type<?> value : values) {
                encoded.append(TypeEncoder.encode(value));
            }
            return encoded.toString();
        }
    }
}
