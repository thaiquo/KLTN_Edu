package iuh.fit.contract_service.blockchain;

import org.web3j.abi.EventEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.BytesType;
import org.web3j.abi.datatypes.Event;
import org.web3j.abi.datatypes.NumericType;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint32;
import org.web3j.abi.datatypes.generated.Uint64;
import org.web3j.abi.datatypes.generated.Uint8;
import org.web3j.utils.Numeric;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

public class EduConnectEscrowEventDecoder {
    private static final List<EventSpec> EVENT_SPECS = List.of(
            spec(EscrowEventType.AGREEMENT_REGISTERED, "AgreementRegistered",
                    indexed("agreementId", new TypeReference<Bytes32>(true) {}),
                    indexed("student", new TypeReference<Address>(true) {}),
                    indexed("tutor", new TypeReference<Address>(true) {}),
                    field("termsHash", new TypeReference<Bytes32>() {}),
                    field("totalAmount", new TypeReference<Uint256>() {}),
                    field("pricePerSession", new TypeReference<Uint256>() {}),
                    field("totalSessions", new TypeReference<Uint32>() {}),
                    field("paymentDeadline", new TypeReference<Uint64>() {})),
            spec(EscrowEventType.AGREEMENT_FUNDED, "AgreementFunded",
                    indexed("agreementId", new TypeReference<Bytes32>(true) {}),
                    indexed("student", new TypeReference<Address>(true) {}),
                    field("amount", new TypeReference<Uint256>() {})),
            spec(EscrowEventType.SESSION_SETTLEMENT_PROPOSED, "SessionSettlementProposed",
                    indexed("agreementId", new TypeReference<Bytes32>(true) {}),
                    indexed("sessionId", new TypeReference<Bytes32>(true) {}),
                    field("outcome", new TypeReference<Uint8>() {}),
                    field("disputeDeadline", new TypeReference<Uint64>() {}),
                    field("evidenceHash", new TypeReference<Bytes32>() {})),
            spec(EscrowEventType.TUTOR_FRAUD_DISPUTE_OPENED, "TutorFraudDisputeOpened",
                    indexed("agreementId", new TypeReference<Bytes32>(true) {}),
                    indexed("sessionId", new TypeReference<Bytes32>(true) {}),
                    field("evidenceHash", new TypeReference<Bytes32>() {})),
            spec(EscrowEventType.SESSION_SETTLED, "SessionSettled",
                    indexed("agreementId", new TypeReference<Bytes32>(true) {}),
                    indexed("sessionId", new TypeReference<Bytes32>(true) {}),
                    field("outcome", new TypeReference<Uint8>() {}),
                    field("finalStatus", new TypeReference<Uint8>() {}),
                    field("tutorAmount", new TypeReference<Uint256>() {}),
                    field("platformAmount", new TypeReference<Uint256>() {}),
                    field("studentRefund", new TypeReference<Uint256>() {})),
            spec(EscrowEventType.TUTOR_FRAUD_DISPUTE_RESOLVED, "TutorFraudDisputeResolved",
                    indexed("agreementId", new TypeReference<Bytes32>(true) {}),
                    indexed("sessionId", new TypeReference<Bytes32>(true) {}),
                    field("complaintApproved", new TypeReference<Bool>() {}),
                    field("resolutionHash", new TypeReference<Bytes32>() {})),
            spec(EscrowEventType.AGREEMENT_COMPLETED, "AgreementCompleted",
                    indexed("agreementId", new TypeReference<Bytes32>(true) {})),
            spec(EscrowEventType.AGREEMENT_EXPIRED, "AgreementExpired",
                    indexed("agreementId", new TypeReference<Bytes32>(true) {})),
            spec(EscrowEventType.AGREEMENT_CANCELLED, "AgreementCancelled",
                    indexed("agreementId", new TypeReference<Bytes32>(true) {}),
                    field("reasonHash", new TypeReference<Bytes32>() {})),
            spec(EscrowEventType.UNUSED_AMOUNT_REFUNDED, "UnusedAmountRefunded",
                    indexed("agreementId", new TypeReference<Bytes32>(true) {}),
                    indexed("student", new TypeReference<Address>(true) {}),
                    field("amount", new TypeReference<Uint256>() {})));

    private final Map<String, EventSpec> specsByTopic;

    public EduConnectEscrowEventDecoder() {
        Map<String, EventSpec> topics = new LinkedHashMap<>();
        for (EventSpec spec : EVENT_SPECS) {
            topics.put(EventEncoder.encode(spec.event()).toLowerCase(Locale.ROOT), spec);
        }
        specsByTopic = Map.copyOf(topics);
    }

    public Optional<DecodedEscrowEvent> decode(BlockchainLog log) {
        if (log.topics().isEmpty()) {
            return Optional.empty();
        }
        EventSpec spec = specsByTopic.get(log.topics().getFirst().toLowerCase(Locale.ROOT));
        if (spec == null) {
            return Optional.empty();
        }
        if (log.topics().size() != spec.indexedFields().size() + 1) {
            throw new IllegalArgumentException("Invalid topic count for " + spec.event().getName());
        }

        Map<String, String> attributes = new LinkedHashMap<>();
        for (int index = 0; index < spec.indexedFields().size(); index++) {
            EventField field = spec.indexedFields().get(index);
            attributes.put(field.name(), decodeIndexed(log.topics().get(index + 1), field.type()));
        }

        List<Type> values = FunctionReturnDecoder.decode(log.data(), spec.event().getNonIndexedParameters());
        if (values.size() != spec.dataFields().size()) {
            throw new IllegalArgumentException("Invalid event data for " + spec.event().getName());
        }
        for (int index = 0; index < values.size(); index++) {
            attributes.put(spec.dataFields().get(index).name(), canonical(values.get(index)));
        }

        return Optional.of(new DecodedEscrowEvent(
                spec.type(),
                attributes.get("agreementId"),
                attributes.get("sessionId"),
                attributes));
    }

    private static String decodeIndexed(String topic, TypeReference<?> type) {
        if (topic == null || !topic.matches("^0x[0-9a-fA-F]{64}$")) {
            throw new IllegalArgumentException("Indexed event topic is not bytes32");
        }
        try {
            if (Address.class.isAssignableFrom(type.getClassType())) {
                return "0x" + topic.substring(topic.length() - 40).toLowerCase(Locale.ROOT);
            }
        } catch (ClassNotFoundException exception) {
            throw new IllegalArgumentException("Cannot resolve indexed event type", exception);
        }
        return topic.toLowerCase(Locale.ROOT);
    }

    private static String canonical(Type value) {
        if (value instanceof NumericType numeric) {
            return numeric.getValue().toString();
        }
        if (value instanceof Bool bool) {
            return bool.getValue().toString();
        }
        if (value instanceof Address address) {
            return address.getValue().toLowerCase(Locale.ROOT);
        }
        if (value instanceof BytesType bytes) {
            return Numeric.toHexString(bytes.getValue()).toLowerCase(Locale.ROOT);
        }
        return String.valueOf(value.getValue());
    }

    private static EventSpec spec(EscrowEventType type, String name, EventField... fields) {
        List<EventField> indexed = new ArrayList<>();
        List<EventField> data = new ArrayList<>();
        List<TypeReference<?>> parameters = new ArrayList<>();
        for (EventField field : fields) {
            parameters.add(field.type());
            (field.type().isIndexed() ? indexed : data).add(field);
        }
        return new EventSpec(type, new Event(name, parameters), List.copyOf(indexed), List.copyOf(data));
    }

    private static EventField indexed(String name, TypeReference<?> type) {
        return new EventField(name, type);
    }

    private static EventField field(String name, TypeReference<?> type) {
        return new EventField(name, type);
    }

    private record EventField(String name, TypeReference<?> type) {
    }

    private record EventSpec(
            EscrowEventType type,
            Event event,
            List<EventField> indexedFields,
            List<EventField> dataFields) {
    }
}
