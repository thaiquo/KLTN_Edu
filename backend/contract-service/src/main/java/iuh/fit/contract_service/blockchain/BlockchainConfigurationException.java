package iuh.fit.contract_service.blockchain;

public class BlockchainConfigurationException extends IllegalStateException {
    public BlockchainConfigurationException(String message) {
        super(message);
    }

    public BlockchainConfigurationException(String message, Throwable cause) {
        super(message, cause);
    }
}
