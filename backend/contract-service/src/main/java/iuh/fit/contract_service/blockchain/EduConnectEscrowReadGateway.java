package iuh.fit.contract_service.blockchain;

import iuh.fit.contract_service.config.BlockchainProperties;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint32;
import org.web3j.abi.datatypes.generated.Uint64;
import org.web3j.abi.datatypes.generated.Uint8;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.util.List;

public class EduConnectEscrowReadGateway {
    private final BlockchainProperties properties;
    private final BlockchainRpcClient rpcClient;

    public EduConnectEscrowReadGateway(BlockchainProperties properties, BlockchainRpcClient rpcClient) {
        this.properties = properties;
        this.rpcClient = rpcClient;
    }

    public BlockchainNetworkSnapshot validateConfiguration() {
        BigInteger actualChainId = rpcClient.getChainId();
        BigInteger expectedChainId = BigInteger.valueOf(properties.getChainId());
        if (!expectedChainId.equals(actualChainId)) {
            throw new BlockchainConfigurationException(
                    "Configured chain ID " + expectedChainId + " does not match RPC chain ID " + actualChainId);
        }

        requireContractCode("escrow", properties.getEscrowAddress());
        requireContractCode("USDC", properties.getUsdcAddress());

        String configuredToken = properties.getUsdcAddress();
        String escrowToken = readAddress(properties.getEscrowAddress(), "usdc");
        if (!configuredToken.equalsIgnoreCase(escrowToken)) {
            throw new BlockchainConfigurationException(
                    "Escrow token " + escrowToken + " does not match configured token " + configuredToken);
        }

        int actualDecimals = readUint8(properties.getUsdcAddress(), "decimals");
        if (actualDecimals != properties.getTokenDecimals()) {
            throw new BlockchainConfigurationException(
                    "Token decimals " + actualDecimals + " do not match configured decimals "
                            + properties.getTokenDecimals());
        }

        String platformWallet = readAddress(properties.getEscrowAddress(), "platformWallet");
        if (isZeroAddress(platformWallet)) {
            throw new BlockchainConfigurationException("Escrow platform wallet must not be the zero address");
        }

        return new BlockchainNetworkSnapshot(
                actualChainId,
                properties.getEscrowAddress(),
                configuredToken,
                actualDecimals,
                platformWallet);
    }

    public OnChainAgreementSnapshot readAgreement(String onChainAgreementId) {
        byte[] agreementId = Numeric.hexStringToByteArray(onChainAgreementId);
        if (agreementId.length != 32) {
            throw new IllegalArgumentException("On-chain agreement ID must contain exactly 32 bytes");
        }

        Function function = new Function(
                "getAgreement",
                List.of(new Bytes32(agreementId)),
                List.of(
                        new TypeReference<Address>() { },
                        new TypeReference<Address>() { },
                        new TypeReference<Bytes32>() { },
                        new TypeReference<Uint256>() { },
                        new TypeReference<Uint256>() { },
                        new TypeReference<Uint256>() { },
                        new TypeReference<Uint256>() { },
                        new TypeReference<Uint256>() { },
                        new TypeReference<Uint64>() { },
                        new TypeReference<Uint32>() { },
                        new TypeReference<Uint32>() { },
                        new TypeReference<Uint32>() { },
                        new TypeReference<Uint8>() { }));

        List<Type> values = decode(properties.getEscrowAddress(), function);
        if (values.size() != 13) {
            throw new BlockchainConfigurationException("getAgreement returned an invalid response");
        }

        return new OnChainAgreementSnapshot(
                ((Address) values.get(0)).getValue(),
                ((Address) values.get(1)).getValue(),
                Numeric.toHexString(((Bytes32) values.get(2)).getValue()),
                uint(values, 3),
                uint(values, 4),
                uint(values, 5),
                uint(values, 6),
                uint(values, 7),
                uint(values, 8),
                uint(values, 9),
                uint(values, 10),
                uint(values, 11),
                OnChainAgreementStatus.fromValue(uint(values, 12)));
    }

    private void requireContractCode(String label, String address) {
        String code = rpcClient.getCode(address);
        if (code == null || code.isBlank() || code.equalsIgnoreCase("0x") || code.equalsIgnoreCase("0x0")) {
            throw new BlockchainConfigurationException(
                    "Configured " + label + " address has no bytecode on chain " + properties.getChainId());
        }
    }

    private String readAddress(String contractAddress, String functionName) {
        Function function = new Function(
                functionName,
                List.of(),
                List.of(new TypeReference<Address>() {
                }));
        Type<?> result = decodeSingle(contractAddress, function);
        if (!(result instanceof Address address)) {
            throw new BlockchainConfigurationException(functionName + " did not return an address");
        }
        return address.getValue();
    }

    private int readUint8(String contractAddress, String functionName) {
        Function function = new Function(
                functionName,
                List.of(),
                List.of(new TypeReference<Uint8>() {
                }));
        Type<?> result = decodeSingle(contractAddress, function);
        if (!(result instanceof Uint8 value)) {
            throw new BlockchainConfigurationException(functionName + " did not return uint8");
        }
        return value.getValue().intValueExact();
    }

    private Type<?> decodeSingle(String contractAddress, Function function) {
        List<Type> decoded = decode(contractAddress, function);
        if (decoded.size() != 1) {
            throw new BlockchainConfigurationException(
                    function.getName() + " returned an empty or invalid response");
        }
        return decoded.getFirst();
    }

    private List<Type> decode(String contractAddress, Function function) {
        String encodedResult = rpcClient.ethCall(contractAddress, function);
        return FunctionReturnDecoder.decode(encodedResult, function.getOutputParameters());
    }

    private static BigInteger uint(List<Type> values, int index) {
        Object value = values.get(index).getValue();
        if (!(value instanceof BigInteger number)) {
            throw new BlockchainConfigurationException("Invalid uint value at getAgreement output " + index);
        }
        return number;
    }

    private static boolean isZeroAddress(String address) {
        return address == null || address.matches("(?i)^0x0{40}$");
    }
}
