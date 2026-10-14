package iuh.fit.contract_service.config;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BlockchainPropertiesTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void disabledConfigurationDoesNotRequireRpcOrAddresses() {
        BlockchainProperties properties = new BlockchainProperties();

        assertTrue(validator.validate(properties).isEmpty());
        assertEquals(50, properties.getEventBlockBatchSize());
        assertEquals(10, properties.getEventLogRequestBlockRange());
    }

    @Test
    void enabledConfigurationFailsFastWhenIncomplete() {
        BlockchainProperties properties = new BlockchainProperties();
        properties.setEnabled(true);

        assertFalse(validator.validate(properties).isEmpty());
    }

    @Test
    void acceptsCompleteAnvilReadOnlyConfiguration() {
        BlockchainProperties properties = new BlockchainProperties();
        properties.setEnabled(true);
        properties.setChainId(31_337);
        properties.setRpcUrl(URI.create("http://127.0.0.1:8545"));
        properties.setEscrowAddress("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
        properties.setUsdcAddress("0x5FbDB2315678afecb367f032d93F642f64180aa3");

        assertTrue(validator.validate(properties).isEmpty());
    }

    @Test
    void rejectsSameAddressForTokenAndEscrow() {
        BlockchainProperties properties = new BlockchainProperties();
        properties.setEnabled(true);
        properties.setChainId(31_337);
        properties.setRpcUrl(URI.create("http://127.0.0.1:8545"));
        properties.setEscrowAddress("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
        properties.setUsdcAddress("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

        assertFalse(validator.validate(properties).isEmpty());
    }

    @Test
    void acceptsAndDeduplicatesOrderedFallbackRpcUrls() {
        BlockchainProperties properties = completeProperties();
        URI primary = properties.getRpcUrl();
        URI fallback = URI.create("https://ethereum-sepolia-rpc.publicnode.com");
        properties.setFallbackRpcUrls(List.of(primary, fallback));

        assertTrue(validator.validate(properties).isEmpty());
        assertTrue(properties.getRpcUrls().equals(List.of(primary, fallback)));
    }

    @Test
    void rejectsNonHttpFallbackRpcUrl() {
        BlockchainProperties properties = completeProperties();
        properties.setFallbackRpcUrls(List.of(URI.create("ws://localhost:8546")));

        assertFalse(validator.validate(properties).isEmpty());
    }

    @Test
    void rejectsLogRequestRangeAboveAlchemyFreeTierLimit() {
        BlockchainProperties properties = completeProperties();
        properties.setEventLogRequestBlockRange(11);

        assertFalse(validator.validate(properties).isEmpty());
    }

    private static BlockchainProperties completeProperties() {
        BlockchainProperties properties = new BlockchainProperties();
        properties.setEnabled(true);
        properties.setChainId(31_337);
        properties.setRpcUrl(URI.create("http://127.0.0.1:8545"));
        properties.setEscrowAddress("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
        properties.setUsdcAddress("0x5FbDB2315678afecb367f032d93F642f64180aa3");
        return properties;
    }
}
