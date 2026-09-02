package iuh.fit.contract_service.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "contract.document")
public record ContractDocumentProperties(
        String templateResource,
        String templateVersion,
        String converterUrl,
        Duration converterConnectTimeout,
        Duration converterReadTimeout,
        long maxDocxBytes,
        long maxPdfBytes,
        String verificationBaseUrl,
        String platformOperatorName,
        String platformContactAddress,
        String platformSupportEmail
) {
    public ContractDocumentProperties {
        if (converterConnectTimeout == null) converterConnectTimeout = Duration.ofSeconds(5);
        if (converterReadTimeout == null) converterReadTimeout = Duration.ofSeconds(60);
        if (maxDocxBytes <= 0) maxDocxBytes = 10_485_760L;
        if (maxPdfBytes <= 0) maxPdfBytes = 20_971_520L;
    }
}
