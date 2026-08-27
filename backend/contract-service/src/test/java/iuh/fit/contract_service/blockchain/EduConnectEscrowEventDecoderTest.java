package iuh.fit.contract_service.blockchain;

import org.junit.jupiter.api.Test;
import org.web3j.abi.EventEncoder;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Event;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint8;

import java.math.BigInteger;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EduConnectEscrowEventDecoderTest {
    private static final String CONTRACT = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
    private static final String AGREEMENT = "0x" + "11".repeat(32);
    private static final String SESSION = "0x" + "22".repeat(32);
    private static final String STUDENT = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";

    private final EduConnectEscrowEventDecoder decoder = new EduConnectEscrowEventDecoder();

    @Test
    void decodesAgreementFundedIndexedAndDataFields() {
        Event event = new Event("AgreementFunded", List.of(
                new TypeReference<Bytes32>(true) {},
                new TypeReference<Address>(true) {},
                new TypeReference<Uint256>() {}));
        BlockchainLog log = log(
                List.of(EventEncoder.encode(event), AGREEMENT, addressTopic(STUDENT)),
                FunctionEncoder.encodeConstructor(List.of(new Uint256(BigInteger.valueOf(40_000_000)))));

        DecodedEscrowEvent decoded = decoder.decode(log).orElseThrow();

        assertEquals(EscrowEventType.AGREEMENT_FUNDED, decoded.type());
        assertEquals(AGREEMENT, decoded.agreementId());
        assertEquals(STUDENT, decoded.attributes().get("student"));
        assertEquals("40000000", decoded.attributes().get("amount"));
    }

    @Test
    void decodesSessionSettlementAmountsWithoutFloatingPoint() {
        Event event = new Event("SessionSettled", List.of(
                new TypeReference<Bytes32>(true) {},
                new TypeReference<Bytes32>(true) {},
                new TypeReference<Uint8>() {},
                new TypeReference<Uint8>() {},
                new TypeReference<Uint256>() {},
                new TypeReference<Uint256>() {},
                new TypeReference<Uint256>() {}));
        BlockchainLog log = log(
                List.of(EventEncoder.encode(event), AGREEMENT, SESSION),
                FunctionEncoder.encodeConstructor(List.of(
                        new Uint8(0),
                        new Uint8(3),
                        new Uint256(BigInteger.valueOf(3_400_000)),
                        new Uint256(BigInteger.valueOf(600_000)),
                        new Uint256(BigInteger.ZERO))));

        DecodedEscrowEvent decoded = decoder.decode(log).orElseThrow();

        assertEquals(EscrowEventType.SESSION_SETTLED, decoded.type());
        assertEquals(SESSION, decoded.sessionId());
        assertEquals("3400000", decoded.attributes().get("tutorAmount"));
        assertEquals("600000", decoded.attributes().get("platformAmount"));
        assertEquals("0", decoded.attributes().get("studentRefund"));
    }

    @Test
    void ignoresUnknownContractEventSignature() {
        BlockchainLog log = log(List.of("0x" + "ff".repeat(32)), "0x");
        assertTrue(decoder.decode(log).isEmpty());
    }

    private static BlockchainLog log(List<String> topics, String data) {
        return new BlockchainLog(
                CONTRACT, topics, data, 10, "0x" + "aa".repeat(32),
                "0x" + "bb".repeat(32), 0);
    }

    private static String addressTopic(String address) {
        return "0x" + "0".repeat(24) + address.substring(2);
    }
}
