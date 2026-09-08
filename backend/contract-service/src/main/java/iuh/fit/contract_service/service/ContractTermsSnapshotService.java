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
    public static final String SCHEMA_VERSION = "contract-terms-v2";

    private final ObjectMapper objectMapper = new ObjectMapper()
            .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true)
            .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);

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
