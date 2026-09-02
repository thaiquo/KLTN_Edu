package iuh.fit.contract_service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "contract.storage")
public record ContractStorageProperties(
        String provider,
        String localRoot,
        String bucket,
        String region,
        String accessKeyId,
        String secretAccessKey,
        String keyPrefix
) {
    public ContractStorageProperties {
        if (provider == null || provider.isBlank()) provider = "local";
        if (localRoot == null || localRoot.isBlank()) localRoot = "./data/contract-artifacts";
        if (keyPrefix == null) keyPrefix = "dev";
    }
}
