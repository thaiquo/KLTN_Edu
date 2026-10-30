package iuh.fit.contract_service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Hash;

import java.util.Optional;

@Service
public class ContractTermsSnapshotService {
    public static final String SCHEMA_VERSION_V2 = "contract-terms-v2";
    public static final String SCHEMA_VERSION_V3 = "contract-terms-v3";
    public static final String SCHEMA_VERSION_V4 = "contract-terms-v4";
    public static final String SCHEMA_VERSION_V5 = "contract-terms-v5";
    public static final String SCHEMA_VERSION = SCHEMA_VERSION_V5;
    public static final String PROTECTED_MEETING_LINK = "Chỉ cung cấp cho học viên sau khi điểm danh trong giờ học";

    private final ObjectMapper objectMapper = new ObjectMapper()
            .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true)
            .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)
            .configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public String serialize(ContractTermsSnapshot snapshot) {
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Cannot serialize immutable contract terms", ex);
        }
    }

    public Optional<ContractTermsSnapshot> parse(String termsJson) {
        if (termsJson == null || termsJson.isBlank()) return Optional.empty();
        try {
            return Optional.of(objectMapper.readValue(termsJson, ContractTermsSnapshot.class));
        } catch (JsonProcessingException ex) {
            return Optional.empty();
        }
    }

    public String hash(String canonicalTermsJson) {
        return Hash.sha3String(canonicalTermsJson);
    }

    public boolean matchesHash(String termsJson, String expectedHash) {
        return expectedHash != null && expectedHash.equalsIgnoreCase(hash(termsJson));
    }
}
