package iuh.fit.contract_service.config;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BlockchainPropertiesTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void disabledConfigurationDoesNotRequireRpcOrAddresses() {
        BlockchainProperties properties = new BlockchainProperties();

        assertTrue(validator.validate(properties).isEmpty());
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
}
