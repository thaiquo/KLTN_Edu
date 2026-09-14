package iuh.fit.contract_service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "contract.dispute-evidence")
public record DisputeEvidenceProperties(long maxFileBytes) {
    public DisputeEvidenceProperties {
        if (maxFileBytes <= 0) maxFileBytes = 52_428_800L;
    }
}
